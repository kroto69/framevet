import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, MAX_FRAMES } from '../../src/config.js';
import { EXIT, GateError } from '../../src/errors.js';

function projectWith(configText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-unit-cfg-'));
  if (configText !== null) fs.writeFileSync(path.join(dir, 'framevet.config.json'), configText);
  return dir;
}

const valid = {
  entry: 'src/index.js',
  render: { command: 'npx remotion render' },
  kane: { timeoutSec: 120 },
  compositions: {
    PromoVideo: { frames: [150, 420], expect: { '150': 'chips visible', '420': 'logo visible' } },
  },
};

test('valid config loads with all values', () => {
  const dir = projectWith(JSON.stringify(valid));
  const cfg = loadConfig(dir, 'PromoVideo');
  assert.equal(cfg.entry, 'src/index.js');
  assert.equal(cfg.renderCommand, 'npx remotion render');
  assert.equal(cfg.timeoutSec, 120);
  assert.deepEqual(cfg.composition.frames, [150, 420]);
  assert.equal(cfg.composition.expect['150'], 'chips visible');
});

test('render and kane sections are optional with defaults', () => {
  const dir = projectWith(JSON.stringify({ entry: 'src/index.js', compositions: valid.compositions }));
  const cfg = loadConfig(dir, 'PromoVideo');
  assert.equal(cfg.renderCommand, 'npx remotion render');
  assert.equal(cfg.timeoutSec, 360);
});

test('missing config file exits 1 with a fix hint', () => {
  const dir = projectWith(null);
  assert.throws(() => loadConfig(dir, 'PromoVideo'), (e) => {
    assert.ok(e instanceof GateError);
    assert.equal(e.code, EXIT.CONFIG);
    assert.equal(e.stage, 'config');
    assert.match(e.message, /not found/);
    assert.match(e.message, /entry/);
    return true;
  });
});

test('invalid JSON exits 1', () => {
  const dir = projectWith('{ nope');
  assert.throws(() => loadConfig(dir, 'PromoVideo'), (e) => e.code === EXIT.CONFIG && /not valid JSON/.test(e.message));
});

test('missing entry exits 1 with hint', () => {
  const dir = projectWith(JSON.stringify({ compositions: valid.compositions }));
  assert.throws(() => loadConfig(dir, 'PromoVideo'), (e) => e.code === EXIT.CONFIG && /"entry"/.test(e.message) && /add "entry"/.test(e.message));
});

test('missing compositions exits 1 with hint', () => {
  const dir = projectWith(JSON.stringify({ entry: 'src/index.js' }));
  assert.throws(() => loadConfig(dir, 'PromoVideo'), (e) => e.code === EXIT.CONFIG && /"compositions"/.test(e.message));
});

test('unknown composition exits 1 and lists known ones', () => {
  const dir = projectWith(JSON.stringify(valid));
  assert.throws(() => loadConfig(dir, 'Nope'), (e) => e.code === EXIT.CONFIG && /not defined/.test(e.message) && /PromoVideo/.test(e.message));
});

test('frames must be a non-empty array of at most MAX_FRAMES integers', () => {
  const base = { ...valid, compositions: { C: { frames: [1], expect: { '1': 'x' } } } };
  const notArray = projectWith(JSON.stringify({ ...valid, compositions: { C: { frames: 5, expect: { '1': 'x' } } } }));
  assert.throws(() => loadConfig(notArray, 'C'), (e) => e.code === EXIT.CONFIG && /non-empty array/.test(e.message));
  const empty = projectWith(JSON.stringify({ ...base, compositions: { C: { frames: [], expect: {} } } }));
  assert.throws(() => loadConfig(empty, 'C'), (e) => e.code === EXIT.CONFIG && /must not be empty/.test(e.message));
  const tooMany = projectWith(
    JSON.stringify({ ...valid, compositions: { C: { frames: [1, 2, 3, 4, 5], expect: { '1': 'a', '2': 'a', '3': 'a', '4': 'a', '5': 'a' } } } }),
  );
  assert.throws(() => loadConfig(tooMany, 'C'), (e) => e.code === EXIT.CONFIG && new RegExp(`max ${MAX_FRAMES}`).test(e.message));
  const badFrame = projectWith(JSON.stringify({ ...valid, compositions: { C: { frames: [1.5], expect: { '1.5': 'x' } } } }));
  assert.throws(() => loadConfig(badFrame, 'C'), (e) => e.code === EXIT.CONFIG && /not a non-negative integer/.test(e.message));
});

test('every frame must have an expectation, with a fix hint', () => {
  const dir = projectWith(
    JSON.stringify({ ...valid, compositions: { C: { frames: [150, 420], expect: { '150': 'chips visible' } } } }),
  );
  assert.throws(() => loadConfig(dir, 'C'), (e) => e.code === EXIT.CONFIG && /frame 420.*has no expectation/.test(e.message) && /"420"/.test(e.message));
});

test('unknown keys warn but do not fail; extra expect keys warn', () => {
  const warnings = [];
  const dir = projectWith(
    JSON.stringify({ ...valid, bogus: 1, render: { command: 'x', nope: 2 }, kane: { timeoutSec: 5, zzz: 3 }, compositions: { C: { frames: [1], expect: { '1': 'x', '9': 'y' }, extra: true } } }),
  );
  const cfg = loadConfig(dir, 'C', (w) => warnings.push(w));
  assert.equal(cfg.timeoutSec, 5);
  assert.ok(warnings.some((w) => /unknown config key "bogus"/.test(w)));
  assert.ok(warnings.some((w) => /render\.nope/.test(w)));
  assert.ok(warnings.some((w) => /kane\.zzz/.test(w)));
  assert.ok(warnings.some((w) => /C\.extra/.test(w)));
  assert.ok(warnings.some((w) => /expect" key "9"/.test(w)));
});

test('invalid kane.timeoutSec exits 1', () => {
  const dir = projectWith(JSON.stringify({ ...valid, kane: { timeoutSec: -3 } }));
  assert.throws(() => loadConfig(dir, 'PromoVideo'), (e) => e.code === EXIT.CONFIG && /timeoutSec/.test(e.message));
});
