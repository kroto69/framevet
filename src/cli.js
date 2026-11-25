import fs from 'node:fs';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';
import { loadConfig } from './config.js';
import { ensureBrowser, renderStills } from './stills.js';
import { writeGallery, serveDir } from './gallery.js';
import { runKane } from './kane.js';
import { parseObservations, computeVerdict } from './verdict.js';
import { humanReport, jsonReport } from './report.js';
import { createCleanup, signalExitCode } from './cleanup.js';

const USAGE = `usage: framevet <check|render> <Composition> [--json]
  check   run the key-frame gate only
  render  run the gate, then render once if it passes`;

function hintFor(r, command) {
  if (r.ok) {
    return command === 'render' ? 'render finished, output is above' : `gate passed — render with: framevet render ${r.composition}`;
  }
  switch (r.stage) {
    case 'config':
      return 'fix framevet.config.json per the reason, then rerun';
    case 'browser':
      return 'first run downloads the Remotion headless browser (~25 s) — check the Remotion install, then rerun';
    case 'stills':
      return `fix the composition error in the reason, then rerun: framevet check ${r.composition}`;
    case 'kane':
      if (r.code === EXIT.SETUP) return `install kane-cli and log in as the human (kane-cli login), or set FRAMEVET_KANE_BIN — then rerun`;
      if (r.code === EXIT.TIMEOUT) return 'raise kane.timeoutSec in framevet.config.json or simplify the page, then rerun';
      if (r.code === EXIT.CONFIG) return 'fix the config/expectation text per the reason, then rerun';
      return 'fix the composition so every expectation holds at its frame (see observations and evidence frames), then rerun';
    case 'render':
      return 'the gate passed but the render itself failed — read the render output above';
    default:
      return `rerun: framevet check ${r.composition}`;
  }
}

export async function main(argv, io) {
  const { cwd, env, stdout, stderr } = io;
  const cleanup = createCleanup();
  cleanup.installSignalHandlers((signal) => signalExitCode(signal));
  const t0 = Date.now();

  let json = false;
  let command = null;
  let compositionId = null;
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg === '-h' || arg === '--help') {
      stdout.write(USAGE + '\n');
      await cleanup.killAll();
      return EXIT.OK;
    } else if (command === null && (arg === 'check' || arg === 'render')) command = arg;
    else if (compositionId === null && !arg.startsWith('-')) compositionId = arg;
    else {
      stderr.write(USAGE + '\n');
      await cleanup.killAll();
      return EXIT.CONFIG;
    }
  }
  if (command === null || compositionId === null) {
    stderr.write(USAGE + '\n');
    await cleanup.killAll();
    return EXIT.CONFIG;
  }

  const result = {
    composition: compositionId,
    ok: false,
    stage: 'config',
    code: EXIT.CONFIG,
    reason: '',
    observations: [],
    evidence: [],
    rendered: false,
    durationMs: 0,
    evidenceDir: '',
    hint: '',
  };
  const announce = (stage, extra = '') => {
    result.stage = stage;
    stderr.write(`[framevet] stage: ${stage}${extra ? ` — ${extra}` : ''}\n`);
  };

  try {
    announce('config');
    const config = loadConfig(cwd, compositionId, (w) => stderr.write(`[framevet] warning: ${w}\n`));
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
    const runDir = path.join(cwd, '.framevet', runId);
    fs.mkdirSync(path.join(runDir, 'frames'), { recursive: true });
    const ctx = {
      cwd,
      env,
      stderr,
      cleanup,
      config,
      runDir,
      runId,
      composition: config.composition,
    };
    result.evidenceDir = path.relative(cwd, runDir) || '.';
    const rel = (p) => path.relative(cwd, p);

    announce('browser', `npx remotion browser ensure`);
    await ensureBrowser(ctx);

    announce('stills', `frames ${config.composition.frames.join(', ')}`);
    const files = await renderStills(ctx, ctx.composition);
    result.evidence.push(...Object.values(files).map(rel));
    try {
      writeGallery(runDir, ctx.composition);
      result.evidence.push(rel(path.join(runDir, 'index.html')));
    } catch (e) {
      throw new GateError(EXIT.SERVER, 'stills', `could not write gallery index.html: ${e.message}`);
    }

    const served = await serveDir(runDir, cleanup);
    announce('kane', `gallery at ${served.url}`);
    result.evidence.push(rel(path.join(runDir, 'kane.ndjson')));
    const kaneRes = await runKane(ctx, { url: served.url, composition: ctx.composition });
    const observations = parseObservations(kaneRes.raw);
    const verdict = computeVerdict({
      frames: ctx.composition.frames,
      observations,
      code: kaneRes.code,
      signal: kaneRes.signal,
      error: null,
      timedOut: kaneRes.timedOut,
      timeoutSec: config.timeoutSec,
    });
    result.observations = verdict.observations;
    if (!verdict.ok) {
      throw new GateError(verdict.code, 'kane', verdict.reason, { observations: verdict.observations });
    }

    if (command === 'render') {
      const renderCmd = `${config.renderCommand} "${config.entry}" "${compositionId}"`;
      announce('render', renderCmd);
      const res = await cleanup.runTracked('/bin/sh', ['-c', renderCmd], {
        cwd,
        env,
        stdio: json ? ['inherit', 'pipe', 'inherit'] : ['inherit', 'inherit', 'inherit'],
        onStdout: json ? (d) => stderr.write(d) : undefined,
      });
      result.rendered = true;
      if (res.error) {
        throw new GateError(EXIT.RENDER, 'render', `could not start render command "${renderCmd}": ${res.error.message}`);
      }
      if (res.code !== 0) {
        throw new GateError(EXIT.RENDER, 'render', `render command failed (exit ${res.code}): ${renderCmd}`);
      }
    }

    announce('done');
    result.ok = true;
    result.code = EXIT.OK;
    result.reason = command === 'render' ? 'gate passed and render finished' : 'gate passed';
  } catch (e) {
    if (e instanceof GateError) {
      result.ok = false;
      result.code = e.code;
      result.stage = e.stage;
      result.reason = e.reason;
      if (e.extra.observations) result.observations = e.extra.observations;
    } else {
      result.ok = false;
      result.code = EXIT.CONFIG;
      result.reason = `internal error: ${e && e.message ? e.message : e}`;
    }
  }

  result.durationMs = Date.now() - t0;
  result.hint = hintFor(result, command);
  humanReport(result, stderr);
  if (json) jsonReport(result, stdout);
  await cleanup.killAll();
  return result.code;
}
