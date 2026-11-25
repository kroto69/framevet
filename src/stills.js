import fs from 'node:fs';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';

export const REMOTION = Object.freeze({
  NPX: 'npx',
  BROWSER_ENSURE_ARGS: ['remotion', 'browser', 'ensure'],
  stillArgs(entry, compositionId, outFile, frame) {
    return ['remotion', 'still', entry, compositionId, outFile, `--frame=${frame}`];
  },
});

function tail(text) {
  const t = String(text || '').trim();
  return t.length > 400 ? t.slice(-400) : t;
}

export async function ensureBrowser(ctx) {
  const res = await ctx.cleanup.runTracked(REMOTION.NPX, REMOTION.BROWSER_ENSURE_ARGS, {
    cwd: ctx.cwd,
    env: ctx.env,
  });
  if (res.error) {
    throw new GateError(EXIT.SERVER, 'browser', `could not run "${REMOTION.NPX} ${REMOTION.BROWSER_ENSURE_ARGS.join(' ')}": ${res.error.message}`);
  }
  if (res.code !== 0) {
    throw new GateError(
      EXIT.SERVER,
      'browser',
      `Remotion headless browser check failed (exit ${res.code}): ${tail(res.stderr || res.stdout)} — first run downloads the browser (~25 s); rerun once it completes`,
    );
  }
  return res;
}

export async function renderStills(ctx, composition) {
  const framesDir = path.join(ctx.runDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  const files = {};
  for (const frame of composition.frames) {
    const out = path.join(framesDir, `frame-${frame}.png`);
    const res = await ctx.cleanup.runTracked(REMOTION.NPX, REMOTION.stillArgs(ctx.config.entry, composition.id, out, frame), {
      cwd: ctx.cwd,
      env: ctx.env,
    });
    if (res.error) {
      throw new GateError(EXIT.STILL, 'stills', `could not run "npx remotion still" for frame ${frame}: ${res.error.message}`);
    }
    if (res.code !== 0 || !fs.existsSync(out)) {
      throw new GateError(
        EXIT.STILL,
        'stills',
        `still for frame ${frame} failed (exit ${res.code}): ${tail(res.stderr || res.stdout)} — a failing still also catches runtime errors in the composition`,
      );
    }
    files[frame] = out;
  }
  return files;
}
