#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  return result.status ?? 1;
}

function getStagedFiles() {
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--cached', '--diff-filter=ACMR'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Unable to read staged files.\n');
    process.exit(result.status ?? 1);
  }

  return (result.stdout || '')
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

function resolveWorkspaceFilters(stagedFiles) {
  const filters = new Set();

  const hasRootLevelImpact = stagedFiles.some(
    (file) =>
      file === 'pnpm-lock.yaml' ||
      file === 'pnpm-workspace.yaml' ||
      file === 'turbo.json' ||
      file === 'package.json' ||
      file.startsWith('scripts/'),
  );

  if (hasRootLevelImpact) {
    return ['--affected'];
  }

  stagedFiles.forEach((file) => {
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
    }
  });

  return Array.from(filters).map((filter) => `--filter=${filter}`);
}

const stagedFiles = getStagedFiles();
if (stagedFiles.length === 0) {
  console.log('No staged files detected. Skipping staged tests.');
  process.exit(0);
}

const filterArgs = resolveWorkspaceFilters(stagedFiles);
if (filterArgs.length === 0) {
  console.log('No staged files mapped to testable workspaces. Skipping staged tests.');
  process.exit(0);
}

const args = ['exec', 'turbo', 'run', 'test', ...filterArgs];
const status = run('pnpm', args);
process.exit(status);
