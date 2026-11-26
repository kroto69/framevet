import fs from 'node:fs';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';

// All Kane CLI specifics live ONLY here as named constants.
// VERIFIED 2026-11-26 against the official docs (github.com/LambdaTest/kane-cli README,
// testmuai.com/docs/kane-cli-cli-reference): `kane-cli run "<objective>" --agent --headless --url <url>`
// - the objective is a POSITIONAL argument (there is no --objective flag)
// - --agent switches stdout to NDJSON (progress events {"step":N,...} + terminal {"type":"run_end",...});
//   the progress UI goes to stderr
// - --url is the start URL; --headless runs Chrome without a visible window (recommended for automation)
// - exit codes: 0 = passed, 1 = failed (objective ran but did not pass), 2 = error (auth/setup/infra), 3 = timeout/cancelled
export const KANE = Object.freeze({
  BIN_ENV: 'FRAMEVET_KANE_BIN',
  DEFAULT_BIN: 'kane-cli',
  RUN_SUBCOMMAND: 'run',
  AGENT_FLAG: '--agent',
  HEADLESS_FLAG: '--headless',
  URL_FLAG: '--url',
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
    `1. Go to ${url} and wait until the page is fully loaded.`,
    `2. For each labeled frame on the page, judge ONLY its stated expectation from what is visible on the opened page (${expects}). Report exactly one line per frame in this exact form: OBSERVATION <N>: PASS|FAIL - <what is visible or what is missing> (replace <N> with the frame number of that labeled frame).`,
    `3. Finally state PASS only if every frame is PASS, otherwise state FAIL. Always include the per-frame OBSERVATION lines from step 2 in your report, including when the verdict is FAIL.`,
  ];
  return steps.join(' ');
}

export function validateObjective(text) {
  if (!text || !text.trim()) {
    throw new GateError(EXIT.CONFIG, 'kane', 'Kane objective is empty - check the "expect" texts in framevet.config.json (no credits spent)');
  }
  if (text.includes(KANE.FORBIDDEN_SUBSTRING)) {
    throw new GateError(
      EXIT.CONFIG,
      'kane',
      `Kane objective contains an unresolved placeholder "${KANE.FORBIDDEN_SUBSTRING}" - fill in every "expect" text in framevet.config.json (no credits spent)`,
    );
  }
  if (text.length > KANE.MAX_OBJECTIVE_CHARS) {
    throw new GateError(
      EXIT.CONFIG,
      'kane',
      `Kane objective is ${text.length} chars, max is ${KANE.MAX_OBJECTIVE_CHARS} - shorten the "expect" texts in framevet.config.json (no credits spent)`,
    );
  }
  return text;
}

export function kaneArgs(objective, url) {
  return [KANE.RUN_SUBCOMMAND, KANE.AGENT_FLAG, KANE.HEADLESS_FLAG, KANE.URL_FLAG, url, objective];
}

export async function runKane(ctx, { url, composition }) {
  const objective = validateObjective(buildObjective({ url, composition }));
  const ndjsonPath = path.join(ctx.runDir, 'kane.ndjson');
  const stream = fs.createWriteStream(ndjsonPath);
  const bin = kaneBin(ctx.env);
  let child;
  try {
    child = ctx.cleanup.spawnTracked(bin, kaneArgs(objective, url), {
      cwd: ctx.cwd,
      env: ctx.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    stream.end();
    throw new GateError(EXIT.SETUP, 'kane', `could not start Kane binary '${bin}': ${e.message} - install kane-cli, or set ${KANE.BIN_ENV}`);
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
      `Kane binary '${bin}' could not start (${res.error.code || res.error.message}) - install kane-cli and log in as the human (kane-cli login, check kane-cli whoami), or set ${KANE.BIN_ENV} to the correct binary`,
    );
  }
  return { objective, ndjsonPath, raw, code: res.code, signal: res.signal, timedOut: res.timedOut };
}
