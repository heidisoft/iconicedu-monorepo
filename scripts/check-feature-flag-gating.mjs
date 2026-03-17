import fs from 'node:fs';
import { execSync } from 'node:child_process';

const FLAG_IMPORT_PATTERN = /from\s+['"]@iconicedu\/web\/flags['"]/;
const FLAG_USAGE_PATTERN = /\benable[A-Za-z0-9]+\s*\.\s*run\s*\(/;
const EXEMPTION_PATTERN = /flag-exempt:\s*\S+/i;

function isFeatureBearingFile(filePath) {
  if (!filePath) return false;
  if (!filePath.startsWith('apps/web/') && !filePath.startsWith('packages/ui-web/')) {
    return false;
  }
  if (/\.test\.(ts|tsx)$/.test(filePath)) {
    return false;
  }
  if (/\.md$/.test(filePath)) {
    return false;
  }
  if (filePath === 'apps/web/flags.ts') {
    return false;
  }
  return (
    filePath.startsWith('apps/web/app/') ||
    filePath.startsWith('apps/web/lib/') ||
    filePath.startsWith('packages/ui-web/src/components/')
  );
}

function hasFlagReference(source) {
  return FLAG_IMPORT_PATTERN.test(source) || FLAG_USAGE_PATTERN.test(source);
}

function hasFlagExemption(input) {
  return (
    EXEMPTION_PATTERN.test(input.prBody ?? '') ||
    EXEMPTION_PATTERN.test(input.commitMessage ?? '')
  );
}

export function evaluateFeatureFlagGating(input) {
  if (hasFlagExemption(input)) {
    return [];
  }

  const changedFeatureFiles = input.changedFiles.filter(isFeatureBearingFile);
  if (!changedFeatureFiles.length) {
    return [];
  }

  const filesWithFlagRefs = changedFeatureFiles.filter((filePath) =>
    hasFlagReference(input.sources[filePath] ?? ''),
  );

  const flagsCatalogChanged = input.changedFiles.includes('apps/web/flags.ts');

  if (!filesWithFlagRefs.length) {
    return [
      {
        code: 'feature-flags.required',
        description:
          'Feature-bearing changes must reference a web flag, or include flag-exempt: <reason> in PR body/commit message.',
      },
    ];
  }

  if (!flagsCatalogChanged && filesWithFlagRefs.length) {
    return [];
  }

  return [];
}

function resolveBaseRef() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      const baseSha = payload?.pull_request?.base?.sha;
      if (typeof baseSha === 'string' && baseSha.length > 0) {
        return baseSha;
      }
    } catch {
      // ignore malformed payload and fallback
    }
  }
  try {
    return execSync('git merge-base HEAD origin/main', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'HEAD~1';
  }
}

function listChangedFiles(baseRef) {
  const output = execSync(`git diff --name-only --diff-filter=ACMR ${baseRef}...HEAD`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readSources(filePaths) {
  const sources = {};
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    sources[filePath] = fs.readFileSync(filePath, 'utf8');
  }
  return sources;
}

function readPrBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    return '';
  }
  try {
    const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    return typeof payload?.pull_request?.body === 'string'
      ? payload.pull_request.body
      : '';
  } catch {
    return '';
  }
}

function readCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function main() {
  const baseRef = resolveBaseRef();
  const changedFiles = listChangedFiles(baseRef);
  const sources = readSources(changedFiles);
  const violations = evaluateFeatureFlagGating({
    changedFiles,
    sources,
    prBody: readPrBody(),
    commitMessage: readCommitMessage(),
  });

  if (!violations.length) {
    process.stdout.write('Feature flag gating guard passed.\n');
    return;
  }

  process.stderr.write('Feature flag gating guard failed.\n');
  for (const violation of violations) {
    process.stderr.write(`- [${violation.code}] ${violation.description}\n`);
  }
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
