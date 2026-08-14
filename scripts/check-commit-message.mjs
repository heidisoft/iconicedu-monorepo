#!/usr/bin/env node

import { readFileSync } from 'node:fs';

export const CONVENTIONAL_HEADER =
  /^(feat|fix|docs|refactor|perf|test|build|ci|chore|style|revert)(\([a-z0-9][a-z0-9./_-]*\))?!?: ([a-z0-9].*)$/;

export function validateCommitMessage(message) {
  const header = message.trim().split(/\r?\n/, 1)[0] ?? '';

  if (header.startsWith('Merge ') || header.startsWith('Revert "')) {
    return { valid: true, header };
  }

  const match = CONVENTIONAL_HEADER.exec(header);
  const subject = match?.[3] ?? '';
  if (!match || header.length > 100 || subject.endsWith('.')) {
    return {
      valid: false,
      header,
      error:
        'Expected <type>(<optional-scope>): <imperative description> using an allowed type and a header of at most 100 characters.',
    };
  }

  return { valid: true, header };
}

function readMessage(args) {
  const envIndex = args.indexOf('--env');
  if (envIndex !== -1) {
    const name = args[envIndex + 1];
    if (!name) throw new Error('--env requires an environment variable name.');
    return process.env[name] ?? '';
  }

  const textIndex = args.indexOf('--text');
  if (textIndex !== -1) {
    return args.slice(textIndex + 1).join(' ');
  }

  const file = args.find((arg) => arg !== '--');
  if (!file) {
    throw new Error('Pass a commit message file, --text <message>, or --env <name>.');
  }
  return readFileSync(file, 'utf8');
}

function main() {
  const message = readMessage(process.argv.slice(2));
  const result = validateCommitMessage(message);
  if (result.valid) return;

  console.error(`Invalid Conventional Commit header: ${result.header || '(empty)'}`);
  console.error(result.error);
  console.error('Example: feat(web): add guardian dashboard filters');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
