import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const entryFile = path.join(cwd, 'dist', 'apps', 'api', 'src', 'main.js');

let appProcess = null;
let shuttingDown = false;
let restartTimer = null;

function spawnCompiler() {
  const compiler = spawn('pnpm', ['exec', 'nest', 'build', '--watch'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  compiler.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  return compiler;
}

function spawnApp() {
  if (appProcess) {
    appProcess.kill('SIGTERM');
  }

  appProcess = spawn('node', ['--enable-source-maps', entryFile], {
    cwd,
    stdio: 'inherit',
  });

  appProcess.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal && signal !== 'SIGTERM') {
      process.kill(process.pid, signal);
      return;
    }

    if (code && code !== 0) {
      console.error(`[api:dev] app process exited with code ${code}`);
    }
  });
}

async function waitForEntryFile() {
  for (;;) {
    try {
      await access(entryFile);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    spawnApp();
  }, 75);
}

const compiler = spawnCompiler();

await waitForEntryFile();
spawnApp();

const watcher = watch(path.dirname(entryFile), (eventType, filename) => {
  if (!filename || eventType !== 'change' || filename !== 'main.js') {
    return;
  }

  scheduleRestart();
});

function shutdown(signal) {
  shuttingDown = true;
  watcher.close();
  clearTimeout(restartTimer);

  if (appProcess) {
    appProcess.kill('SIGTERM');
  }

  compiler.kill('SIGTERM');

  process.on('exit', () => {
    if (appProcess) {
      appProcess.kill('SIGTERM');
    }
    compiler.kill('SIGTERM');
  });

  process.exit(signal ? 128 : 0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
