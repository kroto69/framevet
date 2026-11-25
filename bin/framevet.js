#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
}).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`framevet internal error: ${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 1;
  },
);
