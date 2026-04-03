#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    encoding: 'utf8',
    ...options,
  });
  return result.status ?? 1;
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function parseArgs(argv) {
  const mode = argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] ?? 'staged';
  const taskArg = argv.find((arg) => arg.startsWith('--tasks='))?.split('=')[1] ?? '';
  const tasks = taskArg
    .split(',')
    .map((task) => task.trim())
    .filter(Boolean);

  if (!tasks.length) {
    process.stderr.write('No tasks provided. Use --tasks=lint,typecheck,test.\n');
    process.exit(1);
  }

  if (mode !== 'staged' && mode !== 'branch') {
    process.stderr.write(`Unsupported mode "${mode}". Use staged or branch.\n`);
    process.exit(1);
  }

  return { mode, tasks };
}

function resolveBaseRef() {
  const upstream = capture('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstream.status === 0) {
    const upstreamRef = upstream.stdout.trim();
    if (upstreamRef) {
      const mergeBase = capture('git', ['merge-base', 'HEAD', upstreamRef]);
      if (mergeBase.status === 0) {
        const sha = mergeBase.stdout.trim();
        if (sha) return sha;
      }
    }
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const mergeBase = capture('git', ['merge-base', 'HEAD', `origin/${baseRef}`]);
    if (mergeBase.status === 0) {
      const sha = mergeBase.stdout.trim();
      if (sha) return sha;
    }
  }

  const previousCommit = capture('git', ['rev-parse', 'HEAD~1']);
  if (previousCommit.status === 0) {
    const sha = previousCommit.stdout.trim();
    if (sha) return sha;
  }

  return null;
}

function getChangedFiles(mode) {
  if (mode === 'staged') {
    const result = capture('git', ['diff', '--name-only', '--cached', '--diff-filter=ACMR']);
    if (result.status !== 0) {
      process.stderr.write(result.stderr || 'Unable to read staged files.\n');
      process.exit(result.status);
    }

    return result.stdout
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  }

  const base = resolveBaseRef();
  if (!base) {
    console.log('No base ref found. Skipping changed-workspace checks.');
    process.exit(0);
  }

  const result = capture('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Unable to read changed files.\n');
    process.exit(result.status);
  }

  return result.stdout
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function resolveWorkspaceFilters(changedFiles) {
  const filters = new Set();

  const hasRootLevelImpact = changedFiles.some(
    (file) =>
      file === 'pnpm-lock.yaml' ||
      file === 'pnpm-workspace.yaml' ||
      file === 'turbo.json' ||
      file === 'package.json' ||
      file.startsWith('.github/') ||
      file.startsWith('.husky/') ||
      file.startsWith('scripts/'),
  );

  if (hasRootLevelImpact) {
    return ['--affected'];
  }

  changedFiles.forEach((file) => {
    if (file.startsWith('apps/web/')) {
      filters.add('web');
      filters.add('@iconicedu/ui-web');
      return;
    }
    if (file.startsWith('apps/mobile/')) {
      filters.add('mobile');
      filters.add('@iconicedu/ui-native');
      return;
    }
    if (file.startsWith('apps/api/')) {
      filters.add('api');
      return;
    }
    if (file.startsWith('packages/ui-web/')) {
      filters.add('@iconicedu/ui-web');
      filters.add('web');
      return;
    }
    if (file.startsWith('packages/ui-native/')) {
      filters.add('@iconicedu/ui-native');
      filters.add('mobile');
      return;
    }
    if (file.startsWith('packages/shared-types/')) {
      filters.add('@iconicedu/shared-types');
      filters.add('web');
      filters.add('mobile');
      filters.add('api');
      return;
    }
    if (file.startsWith('packages/utils/')) {
      filters.add('@iconicedu/utils');
      filters.add('web');
      filters.add('mobile');
      filters.add('api');
      return;
    }
  });

  return Array.from(filters).map((filter) => `--filter=${filter}`);
}

function main() {
  const { mode, tasks } = parseArgs(process.argv.slice(2));
  const changedFiles = getChangedFiles(mode);

  if (!changedFiles.length) {
    console.log(`No ${mode === 'staged' ? 'staged' : 'branch'} files detected. Skipping checks.`);
    process.exit(0);
  }

  const filterArgs = resolveWorkspaceFilters(changedFiles);
  if (!filterArgs.length) {
    console.log('No changed files mapped to app/package workspaces. Skipping checks.');
    process.exit(0);
  }

  const status = run('pnpm', ['exec', 'turbo', 'run', ...tasks, ...filterArgs]);
  process.exit(status);
}

main();
