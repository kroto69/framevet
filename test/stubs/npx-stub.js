#!/usr/bin/env node
// Fake `npx` used ONLY by the integration tests. The test harness copies this
// file into a temp bin dir as `npx` and prepends that dir to PATH, so the CLI's
// `npx remotion ...` calls hit this stub instead of real Remotion.
// Fails on demand via STUB_BROWSER_FAIL=1 / STUB_STILL_FAIL=1.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args[0] !== 'remotion') {
  process.stderr.write(`npx-stub: unexpected args: ${args.join(' ')}\n`);
  process.exitCode = 3;
} else if (args[1] === 'browser') {
  if (process.env.STUB_BROWSER_FAIL === '1') {
    process.stderr.write('npx-stub: simulated failure: could not download headless browser\n');
    process.exitCode = 1;
  }
} else if (args[1] === 'still') {
  const out = args[4];
  const frameArg = args[5] || '';
  const frame = frameArg.replace('--frame=', '');
  if (process.env.STUB_STILL_FAIL === '1' || process.env[`STUB_STILL_FAIL_FRAME_${frame}`] === '1') {
    process.stderr.write('npx-stub: simulated composition error: TypeError: Cannot read properties of undefined (reading \'map\')\n');
    process.exitCode = 1;
  } else {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
  }
}
