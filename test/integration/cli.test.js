import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  makeProject,
  runGate,
  startGate,
  extractPort,
  portOpen,
  pidAlive,
  waitFor,
} from './helpers.js';

function parseJsonStdout(stdout) {
  const lines = stdout.trim().split('\n');
  assert.equal(lines.length, 1, `--json must print exactly one line on stdout, got: ${stdout}`);
  return JSON.parse(lines[0]);
}

test('check passes: exit 0, --json single object on stdout, all observations PASS, no render', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'pass' });
  assert.equal(res.code, 0, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.stage, 'done');
  assert.equal(obj.code, 0);
  assert.equal(obj.composition, 'PromoVideo');
  assert.equal(obj.rendered, false);
  assert.equal(obj.observations.length, 2);
  assert.ok(obj.observations.every((o) => o.status === 'PASS'));
  assert.ok(obj.observations.some((o) => o.frame === 150));
  assert.ok(obj.observations.some((o) => o.frame === 420));
  assert.ok(obj.evidence.some((e) => e.endsWith('kane.ndjson')));
  assert.ok(obj.evidence.some((e) => e.endsWith('frames/frame-150.png')));
  for (const e of obj.evidence) assert.ok(fs.existsSync(path.join(project.dir, e)), `evidence exists: ${e}`);
  assert.match(res.stderr, /FRAMEVET PASSED/);
  assert.match(res.stderr, /stage: config/);
  assert.match(res.stderr, /stage: browser/);
  assert.match(res.stderr, /stage: stills/);
  assert.match(res.stderr, /stage: kane/);
  assert.equal(fs.existsSync(project.marker), false, 'check must never run the render command');
});

test('gate failure: exit 11, FAIL reason, render never starts', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'fail' });
  assert.equal(res.code, 11, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.ok, false);
  assert.equal(obj.stage, 'kane');
  assert.equal(obj.code, 11);
  assert.match(obj.reason, /frame 150: FAIL - last model chip is cut off/);
  assert.equal(obj.observations.length, 2);
  assert.equal(fs.existsSync(project.marker), false, 'render command must never start on gate failure');
  assert.match(res.stderr, /FRAMEVET FAILED/);
});

test('missing observation for a configured frame fails with "no evidence for frame N"', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'missing-observation' });
  assert.equal(res.code, 11, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.match(obj.reason, /no evidence for frame 420/);
  assert.equal(fs.existsSync(project.marker), false);
});

test('pass mode that omits a frame observation also fails (pass requires every frame)', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'pass', FAKE_KANE_FRAMES: '150' });
  assert.equal(res.code, 11, res.stderr);
  assert.match(parseJsonStdout(res.stdout).reason, /no evidence for frame 420/);
});

test('parser survives garbage and truncated lines; garbage-only output means no evidence', { timeout: 60000 }, async () => {
  const okProject = makeProject();
  const okRes = await runGate(okProject, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'garbage' });
  assert.equal(okRes.code, 0, okRes.stderr);
  assert.equal(parseJsonStdout(okRes.stdout).ok, true);

  const badProject = makeProject();
  const badRes = await runGate(badProject, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'garbage',
    FAKE_KANE_GARBAGE_ONLY: '1',
  });
  assert.equal(badRes.code, 11, badRes.stderr);
  assert.match(parseJsonStdout(badRes.stdout).reason, /no evidence for frame 150, 420/);
});

test('kane auth/setup failure (unknown exit code 42) maps to 12 with the raw code', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'auth' });
  assert.equal(res.code, 12, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.stage, 'kane');
  assert.match(obj.reason, /42/);
  assert.equal(fs.existsSync(project.marker), false);
});

test('kane timeout: exit 13, grandchild killed, no port listening', { timeout: 60000 }, async () => {
  const project = makeProject({
    config: {
      entry: 'src/index.js',
      render: { command: 'node "unused"' },
      kane: { timeoutSec: 2 },
      compositions: {
        PromoVideo: { frames: [150, 420], expect: { '150': 'a', '420': 'b' } },
      },
    },
  });
  const pidfile = path.join(project.dir, 'gc.pid');
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'timeout',
    FAKE_KANE_PIDFILE: pidfile,
  });
  assert.equal(res.code, 13, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.stage, 'kane');
  assert.match(obj.reason, /timed out after 2s/);
  const port = extractPort(res.stderr);
  assert.ok(port, 'gallery port must be announced');
  assert.equal(await portOpen(port), false, 'no port may listen after exit');
  const gcPid = Number(fs.readFileSync(pidfile, 'utf8'));
  assert.equal(pidAlive(gcPid), false, 'grandchild of fake kane must be dead after timeout');
});

test('SIGINT mid-run: exit 130, no registry process remains, no listening port', { timeout: 60000 }, async () => {
  const project = makeProject({
    config: {
      entry: 'src/index.js',
      render: { command: 'node "unused"' },
      kane: { timeoutSec: 300 },
      compositions: { PromoVideo: { frames: [150, 420], expect: { '150': 'a', '420': 'b' } } },
    },
  });
  const pidfile = path.join(project.dir, 'gc.pid');
  const gate = startGate(project, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'timeout',
    FAKE_KANE_PIDFILE: pidfile,
  });
  const seen = await waitFor(() => /stage: kane/.test(gate.state.stderr) && fs.existsSync(pidfile), 15000);
  assert.ok(seen, `must reach kane stage with grandchild started, stderr: ${gate.state.stderr}`);
  const port = extractPort(gate.state.stderr);
  assert.ok(port);
  gate.child.kill('SIGINT');
  const res = await gate.done;
  assert.equal(res.code, 130, `expected 130, got ${res.code}`);
  const gcPid = Number(fs.readFileSync(pidfile, 'utf8'));
  assert.equal(await waitFor(() => !pidAlive(gcPid), 8000), true, 'grandchild must be dead after SIGINT');
  assert.equal(await portOpen(port), false, 'no port may listen after SIGINT');
});

test('SIGTERM mid-run: exit 143, no registry process remains, no listening port', { timeout: 60000 }, async () => {
  const project = makeProject({
    config: {
      entry: 'src/index.js',
      render: { command: 'node "unused"' },
      kane: { timeoutSec: 300 },
      compositions: { PromoVideo: { frames: [150, 420], expect: { '150': 'a', '420': 'b' } } },
    },
  });
  const pidfile = path.join(project.dir, 'gc.pid');
  const gate = startGate(project, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'timeout',
    FAKE_KANE_PIDFILE: pidfile,
  });
  await waitFor(() => /stage: kane/.test(gate.state.stderr) && fs.existsSync(pidfile), 15000);
  const port = extractPort(gate.state.stderr);
  gate.child.kill('SIGTERM');
  const res = await gate.done;
  assert.equal(res.code, 143, `expected 143, got ${res.code}`);
  const gcPid = Number(fs.readFileSync(pidfile, 'utf8'));
  assert.equal(await waitFor(() => !pidAlive(gcPid), 8000), true);
  assert.equal(await portOpen(port), false);
});

test('failing still: exit 16, reason carries the still error text, render never starts', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'pass',
    STUB_STILL_FAIL: '1',
  });
  assert.equal(res.code, 16, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.stage, 'stills');
  assert.match(obj.reason, /still for frame 150 failed/);
  assert.match(obj.reason, /simulated composition error/);
  assert.equal(fs.existsSync(project.marker), false);
});

test('browser preflight failure: exit 14 at stage browser', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'pass',
    STUB_BROWSER_FAIL: '1',
  });
  assert.equal(res.code, 14, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.stage, 'browser');
  assert.match(obj.reason, /headless browser check failed/);
});

test('render command on pass: exit 0, render runs exactly once with entry and composition', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['render', 'PromoVideo', '--json'], { FAKE_KANE_MODE: 'pass' });
  assert.equal(res.code, 0, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.rendered, true);
  assert.ok(fs.existsSync(project.marker), 'render spy must have run');
  const spy = JSON.parse(fs.readFileSync(project.marker, 'utf8'));
  assert.ok(spy.argv.includes('PromoVideo'));
  assert.ok(spy.argv.includes('src/index.js'));
});

test('render command failing after a passed gate: exit 15 at stage render', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['render', 'PromoVideo', '--json'], {
    FAKE_KANE_MODE: 'pass',
    SPY_RENDER_EXIT: '7',
  });
  assert.equal(res.code, 15, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.ok, false);
  assert.equal(obj.stage, 'render');
  assert.equal(obj.rendered, true);
  assert.match(obj.reason, /exit 7/);
});

test('unknown composition exits 1 with a hint', { timeout: 60000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['check', 'Nope', '--json'], { FAKE_KANE_MODE: 'pass' });
  assert.equal(res.code, 1, res.stderr);
  const obj = parseJsonStdout(res.stdout);
  assert.equal(obj.stage, 'config');
  assert.match(obj.reason, /not defined/);
  assert.match(obj.reason, /PromoVideo/);
});

test('usage error exits 1', { timeout: 30000 }, async () => {
  const project = makeProject();
  const res = await runGate(project, ['frobnicate'], {});
  assert.equal(res.code, 1);
  assert.match(res.stderr, /usage: framevet/);
});
