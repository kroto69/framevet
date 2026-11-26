import test from 'node:test';
import assert from 'node:assert/strict';
import { parseObservations, parseRunEnd, computeVerdict } from '../../src/verdict.js';
import { EXIT } from '../../src/errors.js';

test('parser extracts observations from NDJSON fields, raw lines, survives garbage and truncated lines', () => {
  const raw = [
    'not json at all',
    '{"type":"step","text":"truncated',
    JSON.stringify({ type: 'observation', text: 'OBSERVATION 150: PASS - all chips visible' }),
    'OBSERVATION 420: FAIL - logo missing"',
    '{"type":"result","status":"failed"}',
    '',
  ].join('\n');
  const obs = parseObservations(raw);
  assert.equal(obs.length, 2);
  assert.deepEqual(obs[0], { frame: 150, status: 'PASS', text: 'all chips visible' });
  assert.equal(obs[1].frame, 420);
  assert.equal(obs[1].status, 'FAIL');
  assert.match(obs[1].text, /logo missing/);
});

test('parser keeps first observation per frame and sorts by frame', () => {
  const raw = [
    'OBSERVATION 420: PASS - later',
    'OBSERVATION 150: PASS - first',
    'OBSERVATION 150: FAIL - duplicate ignored',
  ].join('\n');
  const obs = parseObservations(raw);
  assert.deepEqual(obs.map((o) => o.frame), [150, 420]);
  assert.equal(obs[0].status, 'PASS');
});

test('verdict: all frames PASS with exit 0 is ok', () => {
  const v = computeVerdict({
    frames: [150, 420],
    observations: [
      { frame: 150, status: 'PASS', text: 'ok' },
      { frame: 420, status: 'PASS', text: 'ok' },
    ],
    code: 0,
    timedOut: false,
  });
  assert.equal(v.ok, true);
  assert.equal(v.code, EXIT.OK);
});

test('verdict: missing observation fails with "no evidence for frame N"', () => {
  const v = computeVerdict({
    frames: [150, 420],
    observations: [{ frame: 150, status: 'PASS', text: 'ok' }],
    code: 0,
    timedOut: false,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /no evidence for frame 420/);
});

test('verdict: a bare "passed" without observations is not evidence', () => {
  const obs = parseObservations('{"type":"result","status":"passed"}\nPASS\n');
  const v = computeVerdict({ frames: [150, 420], observations: obs, code: 0, timedOut: false });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /no evidence for frame 150, 420/);
});

test('verdict: any FAIL observation fails with exit 11', () => {
  const v = computeVerdict({
    frames: [150, 420],
    observations: [
      { frame: 150, status: 'FAIL', text: 'last chip cut off' },
      { frame: 420, status: 'PASS', text: 'ok' },
    ],
    code: 0,
    timedOut: false,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /frame 150: FAIL - last chip cut off/);
});

test('verdict: non-zero kane exit without observations maps to 12 with the raw code (unknown code)', () => {
  const v = computeVerdict({ frames: [150], observations: [], code: 42, timedOut: false });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.SETUP);
  assert.match(v.reason, /42/);
});

test('verdict: kane exit 2 (auth/setup/infra, official) maps to 12 with a login hint', () => {
  const v = computeVerdict({ frames: [150], observations: [], code: 2, timedOut: false });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.SETUP);
  assert.match(v.reason, /exit 2/);
  assert.match(v.reason, /kane-cli login/);
});

test('verdict: kane exit 3 (timeout/cancelled, official) maps to 13', () => {
  const v = computeVerdict({ frames: [150], observations: [], code: 3, timedOut: false });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.TIMEOUT);
  assert.match(v.reason, /exit 3/);
});

test('verdict: kane exit 1 (failed, official) with no observations is a verdict failure (11), using run_end summary', () => {
  const runEnd = { type: 'run_end', status: 'failed', summary: 'Page did not load as expected', test_url: 'https://example.test/run/9' };
  const v = computeVerdict({ frames: [150, 420], observations: [], code: 1, timedOut: false, runEnd });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /Kane verdict: failed/);
  assert.match(v.reason, /Page did not load as expected/);
  assert.match(v.reason, /no evidence for frame 150, 420/);
});

test('verdict: stream says all PASS but kane exit 1 -> more severe outcome wins (11, not pass)', () => {
  const v = computeVerdict({
    frames: [150],
    observations: [{ frame: 150, status: 'PASS', text: 'ok' }],
    code: 1,
    timedOut: false,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /more severe/);
});

test('verdict: exit 0 but run_end says failed -> 11 (disagreement, more severe)', () => {
  const runEnd = { type: 'run_end', status: 'failed', summary: 'boom' };
  const v = computeVerdict({
    frames: [150],
    observations: [{ frame: 150, status: 'PASS', text: 'ok' }],
    code: 0,
    timedOut: false,
    runEnd,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.VERDICT);
  assert.match(v.reason, /run_end: failed/);
});

test('parseRunEnd finds the terminal run_end event and ignores garbage', () => {
  const raw = [
    'noise',
    '{"step":1,"status":"done","remark":"ok"}',
    '{"type":"run_end","status":"passed","summary":"done","credits":44,"test_url":"https://x/"}',
    '{"truncated',
  ].join('\n');
  const re = parseRunEnd(raw);
  assert.equal(re.status, 'passed');
  assert.equal(re.credits, 44);
  assert.equal(parseRunEnd('no events here'), null);
});

test('verdict: timeout maps to 13', () => {
  const v = computeVerdict({ frames: [150], observations: [], code: null, timedOut: true, timeoutSec: 360 });
  assert.equal(v.ok, false);
  assert.equal(v.code, EXIT.TIMEOUT);
  assert.match(v.reason, /timed out after 360s/);
});
