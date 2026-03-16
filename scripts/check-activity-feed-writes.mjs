import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_ACTIVITY_FEED_INSERT_UPSERT_FILES = new Set([
  'apps/web/lib/activity-feed/projector/project-activity-events.ts',
]);

const ALLOWED_ACTIVITY_EVENTS_INSERT_FILES = new Set([
  'apps/web/lib/activity-feed/publisher/activity-publisher.ts',
]);

const ACTIVITY_FEED_INSERT_OR_UPSERT_PATTERN =
  /\.from\(\s*['"`]activity_feed_items['"`]\s*\)([\s\S]{0,400}?)\.(insert|upsert)\s*\(/g;
const ACTIVITY_EVENTS_INSERT_PATTERN =
  /\.from\(\s*['"`]activity_events['"`]\s*\)([\s\S]{0,400}?)\.insert\s*\(/g;

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function collectSourceFiles(rootDir) {
  const output = [];
  const stack = [rootDir];
  const ignoredDirectories = new Set([
    '.next',
    'node_modules',
    'dist',
    'build',
    '.turbo',
    'coverage',
  ]);

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
        continue;
      }
      output.push(fullPath);
    }
  }

  return output;
}

function collectPatternViolations(input) {
  const { pattern, sources, allowlistedRelativePaths, code, description } = input;

  const violations = [];
  for (const [filePath, source] of Object.entries(sources)) {
    if (allowlistedRelativePaths.has(filePath)) {
      continue;
    }
    pattern.lastIndex = 0;
    if (pattern.test(source)) {
      violations.push({
        code,
        description,
        filePath,
      });
    }
  }
  return violations;
}

export function findUnauthorizedActivityFeedWritesInSources(sources) {
  return [
    ...collectPatternViolations({
      pattern: ACTIVITY_FEED_INSERT_OR_UPSERT_PATTERN,
      sources,
      allowlistedRelativePaths: ALLOWED_ACTIVITY_FEED_INSERT_UPSERT_FILES,
      code: 'activity_feed_items.insert_or_upsert',
      description:
        'Direct insert/upsert on activity_feed_items is only allowed in the projector.',
    }),
    ...collectPatternViolations({
      pattern: ACTIVITY_EVENTS_INSERT_PATTERN,
      sources,
      allowlistedRelativePaths: ALLOWED_ACTIVITY_EVENTS_INSERT_FILES,
      code: 'activity_events.insert',
      description:
        'Direct insert on activity_events is only allowed in publishActivityEvent.',
    }),
  ];
}

function loadWebSources(repoRoot) {
  const webRoot = path.join(repoRoot, 'apps', 'web');
  const files = collectSourceFiles(webRoot);
  const sources = {};

  for (const absolutePath of files) {
    const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
    const source = fs.readFileSync(absolutePath, 'utf8');
    sources[relativePath] = source;
  }

  return sources;
}

function main() {
  const repoRoot = process.cwd();
  const sources = loadWebSources(repoRoot);
  const violations = findUnauthorizedActivityFeedWritesInSources(sources);

  if (!violations.length) {
    process.stdout.write('Activity feed write guard passed.\n');
    return;
  }

  process.stderr.write('Activity feed write guard failed.\n');
  for (const violation of violations) {
    process.stderr.write(
      `- [${violation.code}] ${violation.filePath}: ${violation.description}\n`,
    );
  }
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
