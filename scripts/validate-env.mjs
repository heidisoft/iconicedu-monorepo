#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const contractPath = path.join(repoRoot, 'config/environment-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function parseArgs(argv) {
  const targetIndex = argv.findIndex((arg) => arg === '--target');
  if (targetIndex === -1 || !argv[targetIndex + 1]) {
    throw new Error('Usage: node scripts/validate-env.mjs --target <target>');
  }
  return { target: argv[targetIndex + 1] };
}

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateUrlIfNeeded(name, value, errors) {
  if (!name.endsWith('_URL') || !isPresent(value)) {
    return;
  }

  try {
    new URL(value);
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}

const { target } = parseArgs(process.argv.slice(2));
const targetSpec = contract.targets[target];

if (!targetSpec) {
  throw new Error(
    `Unknown target "${target}". Expected one of: ${Object.keys(contract.targets).join(', ')}`,
  );
}

const errors = [];

for (const name of targetSpec.required ?? []) {
  const value = process.env[name];
  if (!isPresent(value)) {
    errors.push(`Missing required environment variable: ${name}`);
    continue;
  }
  validateUrlIfNeeded(name, value, errors);
}

for (const group of targetSpec.anyOf ?? []) {
  const hasValue = group.some((name) => isPresent(process.env[name]));
  if (!hasValue) {
    errors.push(
      `Missing required environment variable group: one of ${group.join(', ')}`,
    );
  } else {
    for (const name of group) {
      validateUrlIfNeeded(name, process.env[name], errors);
    }
  }
}

if (errors.length > 0) {
  console.error(`Environment validation failed for target "${target}":`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Environment validation passed for target "${target}".`);
