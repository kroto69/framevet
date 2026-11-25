import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createCleanup } from '../../src/cleanup.js';

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
  } catch (e) {
    return e.code === 'EPERM';
  }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
    return state !== 'Z';
  } catch {
    return true;
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    const finish = (v) => {
      s.destroy();
      resolve(v);
    };
    s.once('connect', () => finish(true));
    s.once('error', () => finish(false));
    setTimeout(() => finish(false), 2000);
  });
}

test('runTracked captures stdout and exit code', async () => {
  const c = createCleanup();
  const res = await c.runTracked(process.execPath, ['-e', 'process.stdout.write("hi"); process.exit(3)']);
  assert.equal(res.code, 3);
  assert.match(res.stdout, /hi/);
  await c.killAll();
});

test('runTracked timeout SIGTERMs the child', async () => {
  const c = createCleanup();
  const res = await c.runTracked(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 400 });
  assert.equal(res.timedOut, true);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(pidAlive(res.child.pid), false);
  await c.killAll();
});

test('killAll kills the whole process group including grandchildren, and is idempotent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-unit-cleanup-'));
  const pidfile = path.join(dir, 'gc.pid');
  const c = createCleanup();
  const child = c.spawnTracked('/bin/sh', ['-c', `sleep 300 & echo $! > ${pidfile}; sleep 300`], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 400));
  const gcPid = Number(fs.readFileSync(pidfile, 'utf8'));
  assert.equal(pidAlive(gcPid), true);
  assert.equal(pidAlive(child.pid), true);
  await c.killAll();
  await c.killAll();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(pidAlive(gcPid), false, 'grandchild must be dead');
  assert.equal(pidAlive(child.pid), false, 'child must be dead');
});

test('killAll closes registered http servers', async () => {
  const c = createCleanup();
  const server = http.createServer((req, res) => res.end('ok'));
  c.registerServer(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  assert.equal(await portOpen(port), true);
  await c.killAll();
  assert.equal(await portOpen(port), false);
});
