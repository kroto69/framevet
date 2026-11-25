import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function writeGallery(runDir, composition) {
  const cards = composition.frames
    .map((frame) => {
      const exp = escapeHtml(composition.expect[String(frame)]);
      return [
        '    <div class="card">',
        `      <img src="frames/frame-${frame}.png" alt="Frame ${frame}">`,
        `      <div class="meta"><div class="label">Frame ${frame}</div><div class="expect">${exp}</div></div>`,
        '    </div>',
      ].join('\n');
    })
    .join('\n');
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>framevet frames</title>
<style>
  body { margin: 0; background: #111; color: #fff; font-family: system-ui, sans-serif; }
  .row { display: flex; align-items: center; gap: 28px; padding: 18px; }
  .card { display: flex; align-items: center; gap: 20px; }
  img { max-height: 88vh; max-width: 42vw; object-fit: contain; border: 1px solid #555; background: #000; }
  .label { font-size: 56px; font-weight: 800; line-height: 1.1; }
  .expect { font-size: 26px; max-width: 460px; color: #ddd; margin-top: 8px; }
</style>
</head>
<body>
  <div class="row">
${cards}
  </div>
</body>
</html>
`;
  const indexFile = path.join(runDir, 'index.html');
  fs.writeFileSync(indexFile, html);
  return indexFile;
}

export function serveDir(dir, cleanup) {
  return new Promise((resolve, reject) => {
    const root = path.normalize(dir);
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      } catch {
        res.writeHead(400);
        res.end('bad request');
        return;
      }
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const file = path.normalize(path.join(root, rel));
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', (e) => reject(new GateError(EXIT.SERVER, 'kane', `gallery http server failed to start: ${e.message}`)));
    cleanup.registerServer(server);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}/` });
    });
  });
}
