import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const processes = [];
let shuttingDown = false;

function spawnProcess(name, args, stdin = 'ignore') {
  const child = spawn(pnpmCommand, args, {
    cwd: process.cwd(),
    stdio: [stdin, 'inherit', 'inherit'],
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    shuttingDown = true;
    stopAll(name);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) return;

    shuttingDown = true;
    stopAll(name);
    console.error(`[dev] Failed to start ${name}:`, error);
    process.exit(1);
  });

  processes.push({ name, child });
}

function stopAll(exitingName) {
  for (const { name, child } of processes) {
    if (name === exitingName || child.killed) continue;
    child.kill('SIGTERM');
  }
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

spawnProcess(
  'workspace-dev',
  [
    'exec',
    'turbo',
    'run',
    'dev',
    '--filter=web',
    '--filter=api',
    '--filter=@iconicedu/shared-types',
    '--filter=@iconicedu/ui-native',
    '--filter=@iconicedu/ui-web',
    '--filter=@iconicedu/utils',
  ],
  'ignore',
);

spawnProcess('mobile-start', ['run', 'mobile:start'], 'inherit');
