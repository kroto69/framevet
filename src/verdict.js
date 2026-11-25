import { EXIT } from './errors.js';

const OBS_RE = /OBSERVATION\s+(\d+)\s*:\s*(PASS|FAIL)\s*-\s*(.+)$/i;

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

export function computeVerdict({ frames, observations, code, signal, error, timedOut, timeoutSec }) {
  const obsList = observations.map((o) => ({ frame: o.frame, status: o.status, text: o.text }));
  const byFrame = new Map(observations.map((o) => [o.frame, o]));
  const missing = frames.filter((f) => !byFrame.has(f));
  const failed = observations.filter((o) => o.status === 'FAIL');
  if (timedOut) {
    return { ok: false, code: EXIT.TIMEOUT, reason: `Kane timed out after ${timeoutSec}s and was killed`, observations: obsList };
  }
  if (error) {
    return { ok: false, code: EXIT.SETUP, reason: `Kane could not start: ${error.code || error.message}`, observations: obsList };
  }
  if (code !== 0) {
    const rawDesc = `exit code ${code}${signal ? ` (signal ${signal})` : ''}`;
    if (observations.length === 0) {
      return {
        ok: false,
        code: EXIT.SETUP,
        reason: `Kane ${rawDesc} without producing any OBSERVATION line — setup/auth problem? raw code: ${code}`,
        observations: obsList,
      };
    }
    if (failed.length > 0 || missing.length > 0) {
      return { ok: false, code: EXIT.VERDICT, reason: verdictReason(missing, failed, byFrame, frames), observations: obsList };
    }
    return {
      ok: false,
      code: EXIT.SETUP,
      reason: `Kane stream reports all frames PASS but Kane itself ${rawDesc} — reporting the more severe outcome (raw code: ${code})`,
      observations: obsList,
    };
  }
  if (missing.length > 0) {
    return {
      ok: false,
      code: EXIT.VERDICT,
      reason: `no evidence for frame ${missing.join(', ')} — Kane exited 0 but reported no OBSERVATION line for it`,
      observations: obsList,
    };
  }
  if (failed.length > 0) {
    return { ok: false, code: EXIT.VERDICT, reason: verdictReason(missing, failed, byFrame, frames), observations: obsList };
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
