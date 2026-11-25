import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { writeGallery, serveDir } from '../../src/gallery.js';
import { createCleanup } from '../../src/cleanup.js';

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (d) => {
          body += d;
        });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
      })
      .on('error', reject);
  });
}

test('writeGallery emits one index.html with large labels, expectations and image refs, HTML-escaped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-unit-gallery-'));
  fs.mkdirSync(path.join(dir, 'frames'));
  const composition = {
    id: 'C',
    frames: [150, 420],
    expect: { '150': 'all <chips> & "friends" visible', '420': 'logo visible' },
  };
  const index = writeGallery(dir, composition);
  const html = fs.readFileSync(index, 'utf8');
  assert.match(html, /Frame 150/);
  assert.match(html, /Frame 420/);
  assert.match(html, /frames\/frame-150\.png/);
  assert.match(html, /frames\/frame-420\.png/);
  assert.match(html, /all &lt;chips&gt; &amp; &quot;friends&quot; visible/);
  assert.match(html, /font-size: 56px/);
  assert.match(html, /max-height: 88vh/);
});

test('serveDir serves files with content types, 404s missing, blocks traversal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-unit-serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Frame 150</h1>');
  fs.mkdirSync(path.join(dir, 'frames'));
  fs.writeFileSync(path.join(dir, 'frames', 'frame-150.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const cleanup = createCleanup();
  const { url, port } = await serveDir(dir, cleanup);
  assert.equal(port > 0, true);
  const home = await get(url);
  assert.equal(home.status, 200);
  assert.match(home.type, /text\/html/);
  assert.match(home.body, /Frame 150/);
  const img = await get(`${url}frames/frame-150.png`);
  assert.equal(img.status, 200);
  assert.match(img.type, /image\/png/);
  const missing = await get(`${url}nope.png`);
  assert.equal(missing.status, 404);
  const traversal = await get(`${url}%2e%2e/framevet.config.json`);
  assert.ok(traversal.status === 403 || traversal.status === 404);
  assert.ok(!traversal.body.includes('compositions'));
  await cleanup.killAll();
});
