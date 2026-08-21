import fs from 'node:fs';
import path from 'node:path';

const BASELINE_MARKER = 'supabase-access-control-baseline';
const ANON_ACCESS_REVIEW_PATTERN = /supabase-anon-access-reviewed:\s*\S+/i;
const BROAD_POLICY_REVIEW_PATTERN = /supabase-broad-policy-reviewed:\s*\S+/i;

const REQUIRED_BASELINE_PATTERNS = [
  {
    code: 'supabase.baseline.anon-table-revoke',
    pattern: /revoke all privileges on all tables in schema public from public, anon;/,
  },
  {
    code: 'supabase.baseline.anon-sequence-revoke',
    pattern: /revoke all privileges on all sequences in schema public from public, anon;/,
  },
  {
    code: 'supabase.baseline.authenticated-table-acl-rebuild',
    pattern:
      /revoke all privileges on all tables in schema public from authenticated; grant select, insert, update, delete on all tables in schema public to authenticated;/,
  },
  {
    code: 'supabase.baseline.authenticated-sequence-acl-rebuild',
    pattern:
      /revoke all privileges on all sequences in schema public from authenticated; grant usage, select on all sequences in schema public to authenticated;/,
  },
  {
    code: 'supabase.baseline.global-table-default-revoke',
    pattern:
      /alter default privileges for role postgres revoke all privileges on tables from public, anon, authenticated;/,
  },
  {
    code: 'supabase.baseline.schema-table-default-revoke',
    pattern:
      /alter default privileges for role postgres in schema public revoke all privileges on tables from public, anon, authenticated;/,
  },
  {
    code: 'supabase.baseline.global-sequence-default-revoke',
    pattern:
      /alter default privileges for role postgres revoke all privileges on sequences from public, anon, authenticated;/,
  },
  {
    code: 'supabase.baseline.schema-sequence-default-revoke',
    pattern:
      /alter default privileges for role postgres in schema public revoke all privileges on sequences from public, anon, authenticated;/,
  },
  {
    code: 'supabase.baseline.public-delivery-policy-removed',
    pattern:
      /drop policy if exists "deliveries_read_public" on public\.assessment_deliveries;/,
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function normalizeSql(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitStatements(source) {
  return normalizeSql(source)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createsPublicOrUnqualifiedView(statement, materialized = false) {
  const viewType = materialized ? 'materialized\\s+view' : '(?:or\\s+replace\\s+)?view';
  const match = statement.match(
    new RegExp(
      `^create\\s+${viewType}\\s+(?:(?:"?([a-z_][a-z0-9_]*)"?)\\.)?"?[a-z_][a-z0-9_]*"?`,
    ),
  );

  return Boolean(match) && (!match[1] || match[1] === 'public');
}

function policyTargetsPublicRole(statement) {
  const roles = statement.match(/\bto\s+(.+?)(?:\s+using\b|\s+with\s+check\b|$)/)?.[1];
  return Boolean(roles && /\b(?:anon|public)\b/.test(roles));
}

function findPublicTableCreates(statements) {
  const tables = [];
  const pattern =
    /^create\s+(?!temp(?:orary)?\s)table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/;

  for (const statement of statements) {
    const match = statement.match(pattern);
    if (match?.[1]) tables.push(match[1]);
  }

  return tables;
}

function hasRlsEnable(statements, tableName) {
  const escaped = escapeRegExp(tableName);
  return statements.some((statement) =>
    new RegExp(
      `^alter\\s+table(?:\\s+if\\s+exists)?\\s+(?:public\\.)?"?${escaped}"?\\s+enable\\s+row\\s+level\\s+security$`,
    ).test(statement),
  );
}

function violation(code, filePath, description) {
  return { code, filePath, description };
}

function checkBaseline(filePath, source) {
  const normalized = normalizeSql(source);
  return REQUIRED_BASELINE_PATTERNS.filter(
    ({ pattern }) => !pattern.test(`${normalized};`),
  ).map(({ code }) =>
    violation(
      code,
      filePath,
      'The access-control baseline is missing a required least-privilege control.',
    ),
  );
}

function checkMigration(filePath, source) {
  const statements = splitStatements(source);
  const violations = [];
  const anonAccessReviewed = ANON_ACCESS_REVIEW_PATTERN.test(source);
  const broadPolicyReviewed = BROAD_POLICY_REVIEW_PATTERN.test(source);

  for (const statement of statements) {
    if (
      statement.startsWith('grant ') &&
      /\b(all|select|insert|update|delete)\b/.test(statement) &&
      /\bon\s+(?:all\s+tables\s+in\s+schema\s+public|(?:table\s+)?public\.)/.test(
        statement,
      ) &&
      /\bto\b[^;]*\b(?:anon|public)\b/.test(statement) &&
      !anonAccessReviewed
    ) {
      violations.push(
        violation(
          'supabase.anon-table-grant',
          filePath,
          'Anonymous table grants require supabase-anon-access-reviewed: <reason>.',
        ),
      );
    }

    if (
      statement.startsWith('alter default privileges') &&
      /\bgrant\b/.test(statement) &&
      /\bon\s+(tables|sequences)\b/.test(statement) &&
      /\bto\b[^;]*\b(anon|authenticated|public)\b/.test(statement)
    ) {
      violations.push(
        violation(
          'supabase.default-data-api-grant',
          filePath,
          'Future Data API privileges must remain opt-in per object.',
        ),
      );
    }

    if (statement.startsWith('create policy ') && !/\bto\s+/.test(statement)) {
      violations.push(
        violation(
          'supabase.policy-explicit-role',
          filePath,
          'New RLS policies must name their target role with TO.',
        ),
      );
    }

    if (
      statement.startsWith('create policy ') &&
      policyTargetsPublicRole(statement) &&
      !broadPolicyReviewed
    ) {
      violations.push(
        violation(
          'supabase.anonymous-policy-review',
          filePath,
          'Policies for PUBLIC or anon require supabase-broad-policy-reviewed: <reason>.',
        ),
      );
    }

    if (
      statement.startsWith('create policy ') &&
      /\b(?:using|with\s+check)\s*\(\s*true\s*\)/.test(statement) &&
      !broadPolicyReviewed
    ) {
      violations.push(
        violation(
          'supabase.broad-allow-all-policy',
          filePath,
          'Allow-all RLS expressions require supabase-broad-policy-reviewed: <reason>.',
        ),
      );
    }

    if (
      createsPublicOrUnqualifiedView(statement) &&
      !/security_invoker\s*=\s*true/.test(statement)
    ) {
      violations.push(
        violation(
          'supabase.view-security-invoker',
          filePath,
          'Public views must use security_invoker=true so underlying RLS remains effective.',
        ),
      );
    }

    if (createsPublicOrUnqualifiedView(statement, true)) {
      violations.push(
        violation(
          'supabase.materialized-view-exposure',
          filePath,
          'Materialized views must live outside the exposed public schema.',
        ),
      );
    }
  }

  for (const tableName of findPublicTableCreates(statements)) {
    if (!hasRlsEnable(statements, tableName)) {
      violations.push(
        violation(
          'supabase.table-rls-required',
          filePath,
          `Table ${tableName} must enable RLS in the migration that creates it.`,
        ),
      );
    }
  }

  return violations;
}

export function findSupabaseAccessControlViolations(sources) {
  const entries = Object.entries(sources).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const baselineIndex = entries.findIndex(([, source]) =>
    source.includes(BASELINE_MARKER),
  );

  if (baselineIndex === -1) {
    return [
      violation(
        'supabase.baseline.missing',
        'supabase/migrations',
        'The Supabase access-control baseline migration is missing.',
      ),
    ];
  }

  const [baselinePath, baselineSource] = entries[baselineIndex];
  const violations = checkBaseline(baselinePath, baselineSource);

  for (const [filePath, source] of entries.slice(baselineIndex)) {
    violations.push(...checkMigration(filePath, source));
  }

  return violations;
}

function loadMigrationSources(repoRoot) {
  const migrationsRoot = path.join(repoRoot, 'supabase', 'migrations');
  const sources = {};

  for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;
    const absolutePath = path.join(migrationsRoot, entry.name);
    const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
    sources[relativePath] = fs.readFileSync(absolutePath, 'utf8');
  }

  return sources;
}

function main() {
  const violations = findSupabaseAccessControlViolations(
    loadMigrationSources(process.cwd()),
  );

  if (!violations.length) {
    process.stdout.write('Supabase access-control guard passed.\n');
    return;
  }

  process.stderr.write('Supabase access-control guard failed.\n');
  for (const item of violations) {
    process.stderr.write(`- [${item.code}] ${item.filePath}: ${item.description}\n`);
  }
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
