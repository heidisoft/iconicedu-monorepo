#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.html',
  '.yml',
  '.yaml',
]);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function resolveBaseRef() {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const mergeBase = run('git', ['merge-base', 'HEAD', `origin/${baseRef}`]);
    if (mergeBase.status === 0) {
      const sha = mergeBase.stdout.trim();
      if (sha.length > 0) return sha;
    }
  }

  const previousCommit = run('git', ['rev-parse', 'HEAD~1']);
  if (previousCommit.status === 0) {
    const sha = previousCommit.stdout.trim();
    if (sha.length > 0) return sha;
  }

  return null;
}

function isSupported(file) {
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (file.endsWith(ext)) return true;
  }
  return false;
}

const base = resolveBaseRef();
if (!base) {
  console.log('No base commit found. Skipping changed-files Prettier check.');
  process.exit(0);
}

const diff = run('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
if (diff.status !== 0) {
  process.stderr.write(diff.stderr || 'Unable to read changed files.\n');
  process.exit(diff.status);
}

const files = diff.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .filter(isSupported)
  .filter((file) => existsSync(file));

if (files.length === 0) {
  console.log('No changed files matched Prettier-supported extensions.');
  process.exit(0);
}

const prettier = run('pnpm', ['exec', 'prettier', '--check', ...files]);
process.stdout.write(prettier.stdout);
process.stderr.write(prettier.stderr);
process.exit(prettier.status);
