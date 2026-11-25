import test from 'node:test';
import assert from 'node:assert/strict';
import { KANE, buildObjective, validateObjective, kaneArgs, kaneBin } from '../../src/kane.js';
import { EXIT } from '../../src/errors.js';

const composition = {
  id: 'PromoVideo',
  frames: [150, 420],
  expect: { '150': 'all 7 chips visible', '420': 'logo and CTA visible' },
};

test('objective has at most 3 numbered steps, observations before verdict, url included', () => {
  const obj = buildObjective({ url: 'http://127.0.0.1:4321/', composition });
  assert.match(obj, /1\. Open http:\/\/127\.0\.0\.1:4321\//);
  assert.match(obj, /2\./);
  assert.match(obj, /3\. Finally state PASS only if every frame is PASS/);
  assert.match(obj, /OBSERVATION <N>: PASS\|FAIL - /);
  assert.ok(obj.indexOf('OBSERVATION') < obj.indexOf('Finally state PASS'));
  assert.match(obj, /frame 150 expects: "all 7 chips visible"/);
  assert.match(obj, /frame 420 expects: "logo and CTA visible"/);
  assert.ok(!/scroll|seek/i.test(obj), 'objective must not contain scrolling/seeking instructions');
  assert.ok(obj.length <= KANE.MAX_OBJECTIVE_CHARS);
});

test('validateObjective accepts a normal objective', () => {
  const obj = buildObjective({ url: 'http://127.0.0.1:1/', composition });
  assert.equal(validateObjective(obj), obj);
});

test('validateObjective rejects empty objective with exit 1', () => {
  assert.throws(() => validateObjective(''), (e) => e.code === EXIT.CONFIG && /empty/.test(e.message));
  assert.throws(() => validateObjective('   '), (e) => e.code === EXIT.CONFIG);
});

test('validateObjective rejects "{{" placeholders before any credits are spent', () => {
  assert.throws(
    () => validateObjective('open page and check {{chip}}'),
    (e) => e.code === EXIT.CONFIG && /\{\{/.test(e.message) && /no credits spent/.test(e.message),
  );
});

test('validateObjective rejects objectives over 2000 chars', () => {
  assert.throws(() => validateObjective('x'.repeat(KANE.MAX_OBJECTIVE_CHARS + 1)), (e) => e.code === EXIT.CONFIG && /2000/.test(e.message));
  assert.equal(validateObjective('x'.repeat(KANE.MAX_OBJECTIVE_CHARS)).length, KANE.MAX_OBJECTIVE_CHARS);
});

test('an expectation containing "{{" makes the built objective invalid', () => {
  const bad = { ...composition, expect: { '150': 'chip {{name}} visible', '420': 'logo visible' } };
  assert.throws(() => validateObjective(buildObjective({ url: 'http://x/', composition: bad })), (e) => e.code === EXIT.CONFIG);
});

test('kane args and binary override via env', () => {
  assert.deepEqual(kaneArgs('do it'), [KANE.RUN_SUBCOMMAND, KANE.OBJECTIVE_FLAG, 'do it']);
  assert.equal(kaneBin({}), 'kane-cli');
  assert.equal(kaneBin({ [KANE.BIN_ENV]: '/tmp/fake' }), '/tmp/fake');
});
