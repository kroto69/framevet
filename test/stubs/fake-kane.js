#!/usr/bin/env node
// Fake Kane CLI used ONLY by the test suite. Its output is SYNTHETIC: no real
// captured Kane output was available in the build sandbox (/tmp/render-gate-old
// does not exist - see NOTES.md), so the first line is marked synthetic:true.
// Mimics the official --agent NDJSON schema (VERIFIED 2026-11-26 from
// github.com/LambdaTest/kane-cli README): progress events {"step":N,"status",...}
// plus terminal {"type":"run_end","status":"passed|failed",...}; exit codes
// 0=passed, 1=failed, 2=error(auth/setup), 3=timeout.
// Controlled by FAKE_KANE_MODE=pass|fail|missing-observation|failed-no-obs|timeout|auth|garbage
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const mode = process.env.FAKE_KANE_MODE || 'pass';
const frames = (process.env.FAKE_KANE_FRAMES || '150,420').split(',').filter(Boolean).map(Number);

if (args[0] !== 'run' || !args.includes('--agent') || !args.includes('--url')) {
  process.stderr.write(`fake-kane: unexpected args (expected: run --agent ... --url <url> <objective>): ${args.join(' ')}\n`);
  process.exitCode = 2;
} else {
  const line = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  line({ synthetic: true, stub: 'fake-kane', note: 'synthetic stub output; no real Kane capture available' });

  switch (mode) {
    case 'pass':
      line({ step: 1, status: 'running', remark: 'Navigating to the start URL' });
      line({ step: 1, status: 'done', remark: 'Page fully loaded' });
      for (const f of frames) line({ step: 2, status: 'done', remark: `OBSERVATION ${f}: PASS - stub: everything expected is visible` });
      line({ type: 'run_end', status: 'passed', summary: 'All frame expectations verified', credits: 44, test_url: 'https://example.test/run/1' });
      process.exitCode = 0;
      break;
    case 'fail': {
      const [first, ...rest] = frames;
      line({ step: 1, status: 'done', remark: 'Page fully loaded' });
      line({ step: 2, status: 'done', remark: `OBSERVATION ${first}: FAIL - last model chip is cut off at the right edge` });
      for (const f of rest) line({ step: 3, status: 'done', remark: `OBSERVATION ${f}: PASS - stub: ok` });
      line({ type: 'run_end', status: 'failed', summary: 'One frame expectation did not hold', test_url: 'https://example.test/run/2' });
      process.exitCode = 1;
      break;
    }
    case 'missing-observation': {
      for (const f of frames.slice(0, -1)) line({ step: 2, status: 'done', remark: `OBSERVATION ${f}: PASS - stub: ok` });
      line({ type: 'run_end', status: 'passed', summary: 'Verified what it saw' });
      process.exitCode = 0;
      break;
    }
    case 'failed-no-obs':
      line({ step: 1, status: 'failed', remark: 'Could not verify the page' });
      line({ type: 'run_end', status: 'failed', summary: 'Page did not load as expected', reason: 'gallery unreachable' });
      process.exitCode = 1;
      break;
    case 'timeout': {
      const gc = spawn('sleep', ['300']);
      if (process.env.FAKE_KANE_PIDFILE) fs.writeFileSync(process.env.FAKE_KANE_PIDFILE, String(gc.pid));
      line({ step: 1, status: 'running', remark: 'opened page, thinking forever' });
      setInterval(() => {}, 1000);
      break;
    }
    case 'auth':
      process.stderr.write('Error: not authenticated. Run `kane-cli login` first.\n');
      process.exitCode = 2;
      break;
    case 'garbage':
      process.stdout.write('this is not json at all\n');
      process.stdout.write('{"type":"step","text":"truncated\n');
      if (process.env.FAKE_KANE_GARBAGE_ONLY === '1') {
        process.stdout.write('more noise }{\n');
        process.exitCode = 0;
        break;
      }
      for (const f of frames) line({ step: 2, status: 'done', remark: `OBSERVATION ${f}: PASS - stub: visible despite garbage lines` });
      process.stdout.write('random trailing noise\n');
      line({ type: 'run_end', status: 'passed', summary: 'ok despite noise' });
      process.exitCode = 0;
      break;
    default:
      process.stderr.write(`fake-kane: unknown FAKE_KANE_MODE=${mode}\n`);
      process.exitCode = 2;
  }
}
