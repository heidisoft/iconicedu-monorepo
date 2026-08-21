import { execSync } from 'node:child_process';

const PROTECTED_BRANCH = process.env.PROTECTED_BRANCH ?? 'main';

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function main() {
  if (process.env.ALLOW_MAIN_COMMIT === '1') {
    return;
  }

  const branch = currentBranch();
  if (branch !== PROTECTED_BRANCH) {
    return;
  }

  process.stderr.write(
    `Direct commits/pushes to '${PROTECTED_BRANCH}' are blocked. Create a feature branch instead:\n` +
      `  git checkout -b feature/my-change\n` +
      `To bypass intentionally, rerun with ALLOW_MAIN_COMMIT=1.\n`,
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
