import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLI = path.join(ROOT, 'bin', 'framevet.js');
export const STUBS = path.join(ROOT, 'test', 'stubs');
export const FAKE_KANE = path.join(STUBS, 'fake-kane.js');

export function makeProject({ config } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-it-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'index.js'), '// stub entry for tests\n');
  const binDir = path.join(dir, 'bin-stub');
  fs.mkdirSync(binDir);
  fs.copyFileSync(path.join(STUBS, 'npx-stub.js'), path.join(binDir, 'npx'));
  fs.chmodSync(path.join(binDir, 'npx'), 0o755);
  const spy = path.join(STUBS, 'spy-render.js');
  const cfg =
    config || {
      entry: 'src/index.js',
      render: { command: `node "${spy}"` },
      kane: { timeoutSec: 8 },
      compositions: {
        PromoVideo: {
          frames: [150, 420],
          expect: {
            '150': 'all 7 model chips are fully visible, none cut off at the edges',
            '420': 'the logo and the call-to-action text are fully visible',
          },
        },
      },
    };
  fs.writeFileSync(path.join(dir, 'framevet.config.json'), JSON.stringify(cfg, null, 2));
  return { dir, binDir, spy, marker: path.join(dir, 'render-marker.json') };
}

export function startGate(project, args, env = {}, opts = {}) {
  const child = spawn(process.execPath, [CLI, ...args], {
    cwd: project.dir,
    env: {
      ...process.env,
      PATH: `${project.binDir}${path.delimiter}${process.env.PATH}`,
      FRAMEVET_KANE_BIN: FAKE_KANE,
      SPY_RENDER_MARKER: project.marker,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { stdout: '', stderr: '' };
  child.stdout.on('data', (d) => {
    state.stdout += d;
  });
  child.stderr.on('data', (d) => {
    state.stderr += d;
  });
  const done = new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, opts.wallClockMs || 90000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout: state.stdout, stderr: state.stderr });
    });
  });
  return { child, state, done };
}

export function runGate(project, args, env = {}, opts = {}) {
  return startGate(project, args, env, opts).done;
}

export function extractPort(stderr) {
  const m = /gallery at http:\/\/127\.0\.0\.1:(\d+)/.exec(stderr);
  return m ? Number(m[1]) : null;
}

export function portOpen(port) {
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

export function pidAlive(pid) {
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

export async function waitFor(fn, timeoutMs = 10000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fn();
}
