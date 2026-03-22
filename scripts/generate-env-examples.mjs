#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const contractPath = path.join(repoRoot, 'config/environment-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function renderHeader(filePath) {
  return [
    '# Generated from config/environment-contract.json',
    `# Source file: ${filePath}`,
    '# Update the contract, then run `pnpm env:generate`.',
    '',
  ].join('\n');
}

function renderVariable(name, meta) {
  const visibility = meta.classification === 'secret' ? 'secret' : 'public';
  return [
    `# ${meta.description}`,
    `# Owner: ${meta.owner} · Visibility: ${visibility}`,
    `${name}=${meta.example}`,
    '',
  ].join('\n');
}

for (const [filePath, variableNames] of Object.entries(contract.files)) {
  const sections = [renderHeader(filePath)];
  for (const variableName of variableNames) {
    const meta = contract.variables[variableName];
    if (!meta) {
      throw new Error(`Unknown environment variable in contract: ${variableName}`);
    }
    sections.push(renderVariable(variableName, meta));
  }

  const outputPath = path.join(repoRoot, filePath);
  fs.writeFileSync(outputPath, `${sections.join('\n').trim()}\n`);
  console.log(`updated ${filePath}`);
}
