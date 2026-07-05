#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const args = new Set(process.argv.slice(2));
const assumeYes = args.has('--yes') || args.has('-y');
const ready = args.has('--ready');
const includeFullDiff = args.has('--full-diff');
const branchPrefixes = new Set([
  'fix',
  'feat',
  'chore',
  'docs',
  'test',
  'refactor',
  'perf',
  'build',
  'ci',
]);

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const maxDiffBytes = Number(argValue('--max-diff-bytes', '20000'));

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  }).trim();
}

function passthrough(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function git(args, options) {
  return run('git', args, options);
}

function changedFiles() {
  return git(['status', '--porcelain'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeBranchName(value, fallback) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  const [maybePrefix, ...rest] = raw.split('/');
  const prefix = branchPrefixes.has(maybePrefix) ? maybePrefix : 'chore';
  const description = branchPrefixes.has(maybePrefix)
    ? rest.join('/')
    : raw.replace(/^codex\//, '');
  const slug = slugify(description) || slugify(fallback) || 'local-changes';

  return `${prefix}/${slug}`;
}

function extractJson(value) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? value;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('AI response did not include JSON.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function truncate(value, maxBytes) {
  const buffer = Buffer.from(value);
  if (buffer.byteLength <= maxBytes) {
    return value;
  }
  return `${buffer.subarray(0, maxBytes).toString()}\n\n[truncated at ${maxBytes} bytes]`;
}

async function confirm(message) {
  if (assumeYes || !process.stdin.isTTY) {
    return true;
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

function buildAiContext() {
  const sections = [
    ['Current branch', git(['branch', '--show-current'])],
    ['Changed files', git(['status', '--short'])],
    ['Diff stat', git(['diff', '--stat'])],
    ['Name status', git(['diff', '--name-status'])],
    ['Numstat', git(['diff', '--numstat'])],
  ];

  if (includeFullDiff) {
    sections.push([
      `Full diff (truncated to ${maxDiffBytes} bytes)`,
      truncate(git(['diff', '--unified=1']), maxDiffBytes),
    ]);
  }

  return sections.map(([title, body]) => `## ${title}\n${body || '(none)'}`).join('\n\n');
}

function aiSummary(context) {
  const outputFile = join(tmpdir(), `ai-pr-${Date.now()}.json`);
  const prompt = `You generate git and GitHub PR metadata from a compact local-change summary.
Return JSON only, with this exact shape:
{
  "branch": "fix/short-kebab-description",
  "commit": "Terse imperative commit message",
  "title": "[codex] PR title",
  "body": "Markdown PR body with Summary and Tests sections"
}

Rules:
- Branch must use one of these prefixes: fix/, feat/, chore/, docs/, test/, refactor/, perf/, build/, ci/.
- Choose the branch prefix from the change type. Examples: fix/ for bug fixes, feat/ for user-facing features, chore/ for tooling or maintenance.
- Branch description after the prefix must be lowercase kebab-case.
- Commit message should be concise and imperative.
- Body should mention what changed and why.
- If validation is not visible in the summary, use a Tests section with "- Not run (not provided)."
- Infer from filenames and stats. Do not ask for the full diff unless the summary is truly ambiguous.

Local-change summary:
${context}`;

  const result = spawnSync(
    'codex',
    ['exec', '-C', process.cwd(), '-s', 'read-only', '-o', outputFile, prompt],
    { stdio: 'inherit' },
  );

  if (result.status !== 0 || !existsSync(outputFile)) {
    throw new Error('Codex could not generate PR metadata.');
  }

  const suggestion = extractJson(readFileSync(outputFile, 'utf8'));
  const commit = String(suggestion.commit ?? 'Update local changes').trim();

  return {
    branch: normalizeBranchName(suggestion.branch, commit),
    commit,
    title: String(suggestion.title ?? `[codex] ${suggestion.commit}`).trim(),
    body: String(suggestion.body ?? '').trim(),
  };
}

async function main() {
  git(['rev-parse', '--is-inside-work-tree']);

  const files = changedFiles();
  if (files.length === 0) {
    console.log('No local changes to publish.');
    return;
  }

  run('gh', ['--version']);
  passthrough('gh', ['auth', 'status']);

  const context = buildAiContext();
  const suggestion = aiSummary(context);

  console.log('\nFiles to publish:');
  for (const file of files) {
    console.log(`- ${file}`);
  }
  console.log('\nAI suggestion:');
  console.log(`Mode: ${includeFullDiff ? 'full diff' : 'compact summary'}`);
  console.log(`Branch: ${suggestion.branch}`);
  console.log(`Commit: ${suggestion.commit}`);
  console.log(`PR: ${suggestion.title}`);

  if (!(await confirm('\nCreate branch, commit, push, and open PR?'))) {
    console.log('Stopped before changing git state.');
    return;
  }

  const currentBranch = git(['branch', '--show-current']);
  if (currentBranch === 'main' || currentBranch === 'master') {
    passthrough('git', ['checkout', '-b', suggestion.branch]);
  } else {
    console.log(`Using current branch: ${currentBranch}`);
  }

  passthrough('git', ['add', ...files]);
  passthrough('git', ['commit', '-m', suggestion.commit]);

  const branch = git(['branch', '--show-current']);
  passthrough('git', ['push', '-u', 'origin', branch]);

  const bodyFile = join(tmpdir(), `ai-pr-body-${Date.now()}.md`);
  writeFileSync(bodyFile, suggestion.body || 'Generated by scripts/ai-pr.mjs\n');
  passthrough('gh', [
    'pr',
    'create',
    ready ? '--ready' : '--draft',
    '--title',
    suggestion.title,
    '--body-file',
    bodyFile,
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
