import fs from 'node:fs';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';

// All Kane CLI specifics live ONLY here as named constants.
// UNVERIFIED until confirmed from `kane-cli --help` / `kane-cli run --help` on the
// human's machine (kane-cli is not installed in the build sandbox — see NOTES.md).
export const KANE = Object.freeze({
  BIN_ENV: 'FRAMEVET_KANE_BIN',
  DEFAULT_BIN: 'kane-cli',
  RUN_SUBCOMMAND: 'run',
  OBJECTIVE_FLAG: '--objective',
  MAX_OBJECTIVE_CHARS: 2000,
  FORBIDDEN_SUBSTRING: '{{',
});

export function kaneBin(env) {
  return env[KANE.BIN_ENV] || KANE.DEFAULT_BIN;
}

export function buildObjective({ url, composition }) {
  const expects = composition.frames
    .map((f) => `frame ${f} expects: "${composition.expect[String(f)]}"`)
    .join(' ');
  const steps = [
    `1. Open ${url} and wait until the page is fully loaded.`,
    `2. For each labeled frame on the page, judge ONLY its stated expectation from what is visible on the opened page (${expects}). Report exactly one line per frame in this exact form: OBSERVATION <N>: PASS|FAIL - <what is visible or what is missing> (replace <N> with the frame number of that labeled frame).`,
    `3. Finally state PASS only if every frame is PASS, otherwise state FAIL.`,
  ];
  return steps.join(' ');
}

export function validateObjective(text) {
  if (!text || !text.trim()) {
    throw new GateError(EXIT.CONFIG, 'kane', 'Kane objective is empty — check the "expect" texts in framevet.config.json (no credits spent)');
  }
  if (text.includes(KANE.FORBIDDEN_SUBSTRING)) {
    throw new GateError(
      EXIT.CONFIG,
      'kane',
      `Kane objective contains an unresolved placeholder "${KANE.FORBIDDEN_SUBSTRING}" — fill in every "expect" text in framevet.config.json (no credits spent)`,
    );
  }
  if (text.length > KANE.MAX_OBJECTIVE_CHARS) {
    throw new GateError(
      EXIT.CONFIG,
      'kane',
      `Kane objective is ${text.length} chars, max is ${KANE.MAX_OBJECTIVE_CHARS} — shorten the "expect" texts in framevet.config.json (no credits spent)`,
    );
  }
  return text;
}

export function kaneArgs(objective) {
  return [KANE.RUN_SUBCOMMAND, KANE.OBJECTIVE_FLAG, objective];
}

export async function runKane(ctx, { url, composition }) {
  const objective = validateObjective(buildObjective({ url, composition }));
  const ndjsonPath = path.join(ctx.runDir, 'kane.ndjson');
  const stream = fs.createWriteStream(ndjsonPath);
  const bin = kaneBin(ctx.env);
  let child;
  try {
    child = ctx.cleanup.spawnTracked(bin, kaneArgs(objective), {
      cwd: ctx.cwd,
      env: ctx.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    stream.end();
    throw new GateError(EXIT.SETUP, 'kane', `could not start Kane binary "${bin}": ${e.message} — install kane-cli, or set ${KANE.BIN_ENV}`);
  }
  let raw = '';
  child.stdout.on('data', (d) => {
    raw += d;
    stream.write(d);
  });
  child.stderr.on('data', (d) => {
    raw += d;
    stream.write(d);
  });
  const res = await ctx.cleanup.waitExit(child, Math.round(ctx.config.timeoutSec * 1000));
  await new Promise((resolve) => stream.end(resolve));
  if (res.error) {
    throw new GateError(
      EXIT.SETUP,
      'kane',
      `Kane binary "${bin}" could not start (${res.error.code || res.error.message}) — install kane-cli and log in as the human, or set ${KANE.BIN_ENV} to the correct binary`,
    );
  }
  return { objective, ndjsonPath, raw, code: res.code, signal: res.signal, timedOut: res.timedOut };
}
