import { spawn } from 'node:child_process';

const GRACE_MS = 3000;
const POLL_MS = 100;

export function signalExitCode(signal) {
  if (signal === 'SIGINT') return 130;
  if (signal === 'SIGTERM') return 143;
  if (signal === 'SIGHUP') return 129;
  return 1;
}

export function createCleanup() {
  const children = new Set();
  const servers = new Set();
  let killed = false;

  function registerChild(child) {
    children.add(child);
    child.once('exit', () => children.delete(child));
    return child;
  }

  function registerServer(server) {
    servers.add(server);
    server.once('close', () => servers.delete(server));
    return server;
  }

  function signalGroup(child, sig) {
    if (!child || child.pid === undefined) return;
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, sig);
      return;
    } catch {
      try {
        child.kill(sig);
      } catch {
        // already dead
      }
    }
  }

  function spawnTracked(cmd, args, opts = {}) {
    const { onStdout, onStderr, timeoutMs, ...spawnOpts } = opts;
    const child = spawn(cmd, args, { detached: true, ...spawnOpts });
    return registerChild(child);
  }

  function waitExit(child, timeoutMs = 0) {
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = (v) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        resolve(v);
      };
      if (child.exitCode !== null || child.signalCode !== null) {
        finish({ code: child.exitCode, signal: child.signalCode, timedOut: false, error: null });
        return;
      }
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          signalGroup(child, 'SIGTERM');
          setTimeout(() => signalGroup(child, 'SIGKILL'), GRACE_MS);
          finish({ code: null, signal: null, timedOut: true, error: null });
        }, timeoutMs);
      }
      child.once('exit', (code, signal) => finish({ code, signal, timedOut: false, error: null }));
      child.once('error', (error) => finish({ code: null, signal: null, timedOut: false, error }));
    });
  }

  async function runTracked(cmd, args, opts = {}) {
    const { onStdout, onStderr, timeoutMs = 0 } = opts;
    const stdio = opts.stdio || ['ignore', 'pipe', 'pipe'];
    const child = spawnTracked(cmd, args, { ...opts, stdio });
    let stdout = '';
    let stderr = '';
    if (child.stdout) {
      child.stdout.on('data', (d) => {
        stdout += d;
        if (onStdout) onStdout(d);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (d) => {
        stderr += d;
        if (onStderr) onStderr(d);
      });
    }
    const res = await waitExit(child, timeoutMs);
    return { child, code: res.code, signal: res.signal, timedOut: res.timedOut, error: res.error, stdout, stderr };
  }

  async function killAll() {
    if (killed) return;
    killed = true;
    const procs = [...children];
    for (const server of [...servers]) {
      try {
        server.close();
      } catch {
        // ignore
      }
      if (typeof server.closeAllConnections === 'function') {
        try {
          server.closeAllConnections();
        } catch {
          // ignore
        }
      }
    }
    for (const child of procs) signalGroup(child, 'SIGTERM');
    const deadline = Date.now() + GRACE_MS;
    while (Date.now() < deadline && procs.some((c) => c.exitCode === null && c.signalCode === null)) {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    for (const child of procs) signalGroup(child, 'SIGKILL');
  }

  function installSignalHandlers(getExitCode) {
    const shutdown = (signal) => {
      killAll().finally(() => {
        const code = typeof getExitCode === 'function' ? getExitCode(signal) : 1;
        process.exit(code);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
    process.on('uncaughtException', (err) => {
      process.stderr.write(`framevet uncaughtException: ${err && err.stack ? err.stack : err}\n`);
      killAll().finally(() => process.exit(1));
    });
    process.on('unhandledRejection', (err) => {
      process.stderr.write(`framevet unhandledRejection: ${err && err.stack ? err.stack : err}\n`);
      killAll().finally(() => process.exit(1));
    });
  }

  return { registerChild, registerServer, spawnTracked, waitExit, runTracked, killAll, installSignalHandlers };
}
