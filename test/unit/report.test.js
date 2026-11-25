import test from 'node:test';
import assert from 'node:assert/strict';
import { humanReport, jsonReport } from '../../src/report.js';

function fakeStream() {
  return {
    buf: '',
    write(s) {
      this.buf += s;
    },
  };
}

test('jsonReport prints exactly one JSON object with the spec keys and nothing else', () => {
  const out = fakeStream();
  jsonReport(
    {
      composition: 'PromoVideo',
      ok: true,
      stage: 'done',
      code: 0,
      reason: 'gate passed',
      observations: [{ frame: 150, status: 'PASS', text: 'ok' }],
      evidence: ['.framevet/x/kane.ndjson'],
      rendered: false,
      durationMs: 123,
      evidenceDir: '.framevet/x',
      hint: 'h',
    },
    out,
  );
  const lines = out.buf.trim().split('\n');
  assert.equal(lines.length, 1);
  const obj = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(obj).sort(), [
    'code',
    'composition',
    'durationMs',
    'evidence',
    'observations',
    'ok',
    'reason',
    'rendered',
    'stage',
  ]);
  assert.equal(obj.composition, 'PromoVideo');
  assert.equal(obj.ok, true);
  assert.equal(obj.rendered, false);
});

test('humanReport first line is FRAMEVET PASSED/FAILED and total is at most 10 lines', () => {
  for (const ok of [true, false]) {
    const err = fakeStream();
    humanReport(
      {
        composition: 'C',
        ok,
        stage: 'kane',
        code: ok ? 0 : 11,
        reason: 'r',
        observations: [
          { frame: 1, status: 'PASS', text: 'a' },
          { frame: 2, status: 'FAIL', text: 'b' },
          { frame: 3, status: 'PASS', text: 'c' },
          { frame: 4, status: 'PASS', text: 'd' },
        ],
        evidence: [],
        evidenceDir: '.framevet/x',
        hint: 'h',
      },
      err,
    );
    const lines = err.buf.trim().split('\n');
    assert.equal(lines[0], ok ? 'FRAMEVET PASSED' : 'FRAMEVET FAILED');
    assert.ok(lines.length <= 10, `report must be <= 10 lines, got ${lines.length}`);
    assert.ok(lines.some((l) => l.startsWith('evidence: .framevet/x')));
    assert.ok(lines.some((l) => l.startsWith('hint: h')));
  }
});
