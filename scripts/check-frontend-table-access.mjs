// Guards the "frontend table access goes through apps/api" boundary (issue #248).
//
// apps/web and apps/mobile still contain legacy direct Supabase table reads. This
// guard ratchets them down instead of failing on all of them at once:
//
//   1. Files under API_ONLY_PATHS may never query a table directly — their reads
//      have already been moved behind apps/api.
//   2. Any other `<client>.from('<table>')` must be listed for that exact file in
//      the baseline. New files, or new tables in an existing file, fail.
//   3. Baseline entries that no longer match the code fail too, so the baseline
//      shrinks as reads migrate (run with --write-baseline to regenerate).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const FRONTEND_ROOTS = ['apps/web', 'apps/mobile'];
export const BASELINE_PATH = 'scripts/frontend-table-access-baseline.json';
export const DYNAMIC_TABLE = '<dynamic>';

/** Path prefixes whose reads have fully moved behind apps/api. Code here may never
 * query a table directly, whatever the baseline says. */
export const API_ONLY_PATHS = new Map([
  [
    'apps/web/lib/schedules/',
    'GET /schedules/calendar via getScheduleCalendar (apps/web/lib/api/schedules.ts)',
  ],
]);

function apiOnlyReplacement(filePath) {
  for (const [prefix, replacement] of API_ONLY_PATHS) {
    if (filePath.startsWith(prefix)) return replacement;
  }
  return null;
}

const SOURCE_EXTENSION_PATTERN = /\.(?:ts|tsx)$/;
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  '.expo',
  'dist',
  'build',
  'coverage',
  'ios',
  'android',
  'e2e',
  '__tests__',
  '__mocks__',
]);
const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/;

function isNonTableReceiver(receiver, sourceFile) {
  // Array.from, Buffer.from, Uint8Array.from, etc.
  if (ts.isIdentifier(receiver) && /^[A-Z]/.test(receiver.text)) return true;
  // supabase.storage.from('bucket') is Storage, not a table.
  if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'storage') {
    return true;
  }
  if (ts.isIdentifier(receiver) && /storage$/i.test(receiver.getText(sourceFile))) {
    return true;
  }
  return false;
}

/** Returns `[{ table, line }]` for every Supabase-style `.from(...)` table read. */
export function findTableAccesses(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const accesses = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      node.arguments.length >= 1 &&
      !isNonTableReceiver(node.expression.expression, sourceFile)
    ) {
      const [arg] = node.arguments;
      const table =
        ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)
          ? arg.text
          : DYNAMIC_TABLE;
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      accesses.push({ table, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return accesses;
}

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : listSourceFiles(entryPath);
    }
    return SOURCE_EXTENSION_PATTERN.test(entry.name) &&
      !TEST_FILE_PATTERN.test(entry.name)
      ? [entryPath]
      : [];
  });
}

/** `{ [posixPath]: { [table]: line[] } }` for the given roots. */
export function collectTableAccesses(roots = FRONTEND_ROOTS, readFile = fs.readFileSync) {
  const usage = {};
  for (const root of roots) {
    for (const filePath of listSourceFiles(root)) {
      const posixPath = filePath.split(path.sep).join('/');
      for (const { table, line } of findTableAccesses(
        posixPath,
        readFile(filePath, 'utf8'),
      )) {
        usage[posixPath] ??= {};
        (usage[posixPath][table] ??= []).push(line);
      }
    }
  }
  return usage;
}

export function toBaseline(usage) {
  const files = {};
  for (const filePath of Object.keys(usage).sort()) {
    if (apiOnlyReplacement(filePath)) continue;
    files[filePath] = Object.keys(usage[filePath]).sort();
  }
  return { files };
}

/** Compares current usage against the baseline. Returns human-readable violations. */
export function evaluate(usage, baseline) {
  const violations = [];
  const allowed = baseline?.files ?? {};

  for (const [filePath, tables] of Object.entries(usage)) {
    for (const [table, lines] of Object.entries(tables)) {
      const where = `${filePath}:${lines[0]}`;
      const replacement = apiOnlyReplacement(filePath);
      if (replacement) {
        violations.push(
          `${where} reads "${table}" directly, but this path is API-only; use ${replacement}.`,
        );
      } else if (!allowed[filePath]?.includes(table)) {
        violations.push(
          `${where} adds a direct Supabase read of "${table}". Frontend table access ` +
            'must go through apps/api (add or reuse an endpoint in apps/api and a ' +
            'client in lib/api/).',
        );
      }
    }
  }

  for (const [filePath, tables] of Object.entries(allowed)) {
    if (apiOnlyReplacement(filePath)) {
      violations.push(
        `${BASELINE_PATH} lists ${filePath}, but that path is API-only and cannot be baselined.`,
      );
      continue;
    }
    for (const table of tables) {
      if (!usage[filePath]?.[table]) {
        violations.push(
          `${BASELINE_PATH} still lists "${table}" for ${filePath}, which no longer ` +
            'reads it. Remove the stale entry (or run with --write-baseline) so it ' +
            'cannot be re-added silently.',
        );
      }
    }
  }

  return violations;
}

function main() {
  const usage = collectTableAccesses();

  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(toBaseline(usage), null, 2)}\n`);
    process.stdout.write(`Wrote ${BASELINE_PATH}.\n`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const violations = evaluate(usage, baseline);

  if (!violations.length) {
    process.stdout.write('Frontend table access guard passed.\n');
    return;
  }

  process.stderr.write('Frontend table access guard failed.\n');
  for (const violation of violations) process.stderr.write(`- ${violation}\n`);
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
