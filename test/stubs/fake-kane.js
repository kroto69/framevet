#!/usr/bin/env node
// Fake Kane CLI used ONLY by the test suite. Its output is SYNTHETIC: no real
// captured Kane output was available in the build sandbox (/tmp/render-gate-old
// does not exist — see NOTES.md), so every line is marked synthetic:true.
// Controlled by FAKE_KANE_MODE=pass|fail|missing-observation|timeout|auth|garbage
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const mode = process.env.FAKE_KANE_MODE || 'pass';
const frames = (process.env.FAKE_KANE_FRAMES || '150,420').split(',').filter(Boolean).map(Number);

const line = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
line({ synthetic: true, stub: 'fake-kane', note: 'synthetic stub output; no real Kane capture available' });

switch (mode) {
  case 'pass':
    for (const f of frames) line({ type: 'observation', text: `OBSERVATION ${f}: PASS - stub: everything expected is visible` });
    line({ type: 'result', status: 'passed' });
    process.exitCode = 0;
    break;
  case 'fail': {
    const [first, ...rest] = frames;
    line({ type: 'observation', text: `OBSERVATION ${first}: FAIL - last model chip is cut off at the right edge` });
    for (const f of rest) line({ type: 'observation', text: `OBSERVATION ${f}: PASS - stub: ok` });
    line({ type: 'result', status: 'failed' });
    process.exitCode = 0;
    break;
  }
  case 'missing-observation': {
    for (const f of frames.slice(0, -1)) line({ type: 'observation', text: `OBSERVATION ${f}: PASS - stub: ok` });
    line({ type: 'result', status: 'passed' });
    process.exitCode = 0;
    break;
  }
  case 'timeout': {
    const gc = spawn('sleep', ['300']);
    if (process.env.FAKE_KANE_PIDFILE) fs.writeFileSync(process.env.FAKE_KANE_PIDFILE, String(gc.pid));
    line({ type: 'step', text: 'opened page, thinking forever' });
    setInterval(() => {}, 1000);
    break;
  }
  case 'auth':
    process.stderr.write('Error: not authenticated. Run `kane-cli login` first.\n');
    process.exitCode = 42;
    break;
  case 'garbage':
    process.stdout.write('this is not json at all\n');
    process.stdout.write('{"type":"step","text":"truncated\n');
    if (process.env.FAKE_KANE_GARBAGE_ONLY === '1') {
      process.stdout.write('more noise }{\n');
      process.exitCode = 0;
      break;
    }
    for (const f of frames) line({ type: 'observation', text: `OBSERVATION ${f}: PASS - stub: visible despite garbage lines` });
    process.stdout.write('random trailing noise\n');
    process.exitCode = 0;
    break;
  default:
    process.stderr.write(`fake-kane: unknown FAKE_KANE_MODE=${mode}\n`);
    process.exitCode = 2;
}
