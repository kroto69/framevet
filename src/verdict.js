import { EXIT } from './errors.js';

const OBS_RE = /OBSERVATION\s+(\d+)\s*:\s*(PASS|FAIL)\s*-\s*(.+)$/i;

// Official kane-cli exit codes (VERIFIED 2026-11-26, github.com/LambdaTest/kane-cli README):
// 0 = passed, 1 = failed (objective ran but did not pass), 2 = error (auth/setup/infra), 3 = timeout/cancelled
export const KANE_EXIT = Object.freeze({ PASSED: 0, FAILED: 1, ERROR: 2, TIMEOUT: 3 });

export function parseObservations(raw) {
  const byFrame = new Map();
  const text = String(raw || '');
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('OBSERVATION')) continue;
    let hay = line;
    try {
      hay = JSON.stringify(JSON.parse(line));
    } catch {
      // truncated or non-JSON line: scan the raw line as-is
    }
    const m = OBS_RE.exec(hay);
    if (m) {
      const frame = Number(m[1]);
      const status = m[2].toUpperCase();
      const obsText = m[3].replace(/["'}]+$/, '').trim();
      if (!byFrame.has(frame)) byFrame.set(frame, { frame, status, text: obsText });
    }
  }
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

// With --agent, kane-cli emits NDJSON on stdout; the terminal event is {"type":"run_end",...}
// (stable schema: status passed|failed, summary, reason, credits, test_url). Progress events
// are untyped and carry "step". We keep the LAST run_end seen.
export function parseRunEnd(raw) {
  let runEnd = null;
  for (const line of String(raw || '').split(/\r?\n/)) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj && typeof obj === 'object' && obj.type === 'run_end') runEnd = obj;
  }
  return runEnd;
}

function runEndNote(runEnd) {
  if (!runEnd) return '';
  const parts = [`run_end: ${runEnd.status}`];
  if (runEnd.summary) parts.push(String(runEnd.summary));
  if (runEnd.test_url) parts.push(String(runEnd.test_url));
  return ` (${parts.join(' - ')})`;
}

export function computeVerdict({ frames, observations, code, signal, error, timedOut, timeoutSec, runEnd }) {
  const obsList = observations.map((o) => ({ frame: o.frame, status: o.status, text: o.text }));
  const byFrame = new Map(observations.map((o) => [o.frame, o]));
  const missing = frames.filter((f) => !byFrame.has(f));
  const failed = observations.filter((o) => o.status === 'FAIL');
  const kaneFailed = code === KANE_EXIT.FAILED || (runEnd != null && runEnd.status === 'failed');
  const note = runEndNote(runEnd);
  if (timedOut) {
    return { ok: false, code: EXIT.TIMEOUT, reason: `Kane timed out after ${timeoutSec}s and was killed`, observations: obsList };
  }
  if (error) {
    return { ok: false, code: EXIT.SETUP, reason: `Kane could not start: ${error.code || error.message}`, observations: obsList };
  }
  if (code === KANE_EXIT.ERROR) {
    return {
      ok: false,
      code: EXIT.SETUP,
      reason: `Kane error exit 2 (auth/setup/infrastructure)${note} - run 'kane-cli login' and check 'kane-cli whoami' and Chrome, or set FRAMEVET_KANE_BIN; raw code: 2`,
      observations: obsList,
    };
  }
  if (code === KANE_EXIT.TIMEOUT) {
    return { ok: false, code: EXIT.TIMEOUT, reason: `Kane itself timed out or was cancelled (exit 3)${note}`, observations: obsList };
  }
  if (code !== KANE_EXIT.PASSED && code !== KANE_EXIT.FAILED) {
    const rawDesc = `exit code ${code}${signal ? ` (signal ${signal})` : ''}`;
    return {
      ok: false,
      code: EXIT.SETUP,
      reason: `Kane ${rawDesc} (unrecognized code)${note} - treat as setup problem; raw code: ${code}`,
      observations: obsList,
    };
  }
  if (missing.length > 0) {
    const reason = kaneFailed
      ? `Kane verdict: failed${note}; additionally no evidence for frame ${missing.join(', ')}`
      : `no evidence for frame ${missing.join(', ')} - Kane exited ${code} but reported no OBSERVATION line for it`;
    return { ok: false, code: EXIT.VERDICT, reason, observations: obsList };
  }
  if (failed.length > 0 || kaneFailed) {
    const base = verdictReason(missing, failed, byFrame, frames);
    const reason = base
      ? `${base}${kaneFailed ? note : ''}`
      : `Kane exit ${code} (failed) although the stream had all frames PASS - reporting the more severe outcome${note}`;
    return { ok: false, code: EXIT.VERDICT, reason, observations: obsList };
  }
  return { ok: true, code: EXIT.OK, reason: 'every configured frame has a PASS observation', observations: obsList };
}

function verdictReason(missing, failed, byFrame, frames) {
  const parts = [];
  for (const f of frames) {
    const obs = byFrame.get(f);
    if (!obs) parts.push(`frame ${f}: no evidence`);
    else if (obs.status === 'FAIL') parts.push(`frame ${f}: FAIL - ${obs.text}`);
  }
  if (missing.length > 0) parts.push(`no evidence for frame ${missing.join(', ')}`);
  return parts.join('; ');
}
