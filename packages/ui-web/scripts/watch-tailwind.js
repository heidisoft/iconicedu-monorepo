const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function loadChokidar() {
  try {
    return require('chokidar');
  } catch (error) {
    const pnpmDir = path.resolve(__dirname, '../../node_modules/.pnpm');
    if (!fs.existsSync(pnpmDir)) {
      throw error;
    }
    const candidate = fs
      .readdirSync(pnpmDir)
      .find((entry) => entry.startsWith('chokidar@'));
    if (candidate) {
      return require(path.join(pnpmDir, candidate, 'node_modules', 'chokidar'));
    }
    throw error;
  }
}

const chokidar = loadChokidar();

const tailwindArgs = ['-i', './src/styles/global.css', '-o', './dist/ui-web.css'];

const tailwindCliPath = path.resolve(
  __dirname,
  '../../../node_modules/@tailwindcss/cli/dist/index.mjs',
);

let isBuilding = false;
let shouldRunAgain = false;

function runTailwind() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tailwindCliPath, ...tailwindArgs], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Tailwind exited with code ${code}`));
    });
  });
}

async function rebuildTailwind(trigger) {
  if (isBuilding) {
    shouldRunAgain = true;
    return;
  }

  isBuilding = true;
  try {
    console.log(`Rebuilding Tailwind due to ${trigger}`);
    await runTailwind();
  } catch (error) {
    console.error(error);
  } finally {
    isBuilding = false;
  }

  if (shouldRunAgain) {
    shouldRunAgain = false;
    await rebuildTailwind('queued change');
  }
}

const watcher = chokidar.watch(['tailwind.config.ts', 'src/**/*.{ts,tsx,css}'], {
  ignoreInitial: true,
  usePolling: true,
  interval: 1000,
});

watcher.on('all', (event, path) => {
  rebuildTailwind(`${event} ${path}`);
});

rebuildTailwind('initial build');

process.on('SIGINT', () => {
  watcher.close();
  process.exit(0);
});
