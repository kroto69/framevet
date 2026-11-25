import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (target !== 'true' && target !== 'false') {
  console.error('usage: node scripts/toggle.js <true|false>');
  process.exit(1);
}
const wantBroken = target === 'true';
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'PromoVideo.js');
const src = fs.readFileSync(file, 'utf8');
const re = /const DEMO_BROKEN = (true|false); \/\* framevet-demo:bug-switch \*\//;
const m = re.exec(src);
if (!m) {
  console.error('marker "framevet-demo:bug-switch" not found in src/PromoVideo.js');
  process.exit(1);
}
const label = wantBroken ? 'demo:break' : 'demo:fix';
if (m[1] === target) {
  console.log(`${label}: DEMO_BROKEN is already ${target} — no change`);
  process.exit(0);
}
fs.writeFileSync(file, src.replace(re, `const DEMO_BROKEN = ${target}; /* framevet-demo:bug-switch */`));
console.log(`${label}: set DEMO_BROKEN=${target} in src/PromoVideo.js`);
if (wantBroken) {
  console.log('  chip row is 7 x (200px + 16px margin) = 1512px wide inside a 1080px frame,');
  console.log('  so the outer chips are cut off at the edges at frame 150 (the gate should FAIL)');
} else {
  console.log('  chip row is 7 x (130px + 16px margin) = 1022px wide, all chips fit inside the');
  console.log('  1080px frame at frame 150 (the gate should PASS)');
}
