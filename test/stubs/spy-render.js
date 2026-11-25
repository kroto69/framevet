#!/usr/bin/env node
// Spy render command used ONLY by the integration tests: records that it ran.
import fs from 'node:fs';

const marker = process.env.SPY_RENDER_MARKER;
if (marker) {
  fs.writeFileSync(marker, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
}
process.stdout.write(`spy-render ran with args: ${process.argv.slice(2).join(' ')}\n`);
process.exitCode = Number(process.env.SPY_RENDER_EXIT || 0);
