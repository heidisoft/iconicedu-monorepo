#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const defaultSeedFile = path.join(repoRoot, 'supabase/seed.sql');
const validateEnvScript = path.join(repoRoot, 'scripts/validate-env.mjs');

function parseArgs(argv) {
  const parsed = {
    target: undefined,
    databaseUrl: undefined,
    seedFile: defaultSeedFile,
    allowDestroy: false,
    freshBranch: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      parsed.target = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--db-url') {
      parsed.databaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--seed-file') {
      parsed.seedFile = path.resolve(repoRoot, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--allow-destroy') {
      parsed.allowDestroy = true;
      continue;
    }
    if (arg === '--fresh-branch') {
      parsed.freshBranch = true;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/seed-remote.mjs --target <preview|staging> [options]

Options:
  --db-url <url>         Override database connection string
  --seed-file <path>     Override seed file path (default: supabase/seed.sql)
  --fresh-branch         Required for preview seeding
  --allow-destroy        Required for staging reseed
  --dry-run              Print the command without executing psql
  -h, --help             Show this help message
`);
}

function requireArg(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function resolveDatabaseUrl(args, env) {
  return (
    args.databaseUrl?.trim() ||
    env.SEED_DATABASE_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    ''
  );
}

function validateConnectionString(value, name) {
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    throw new Error(`${name} must be a valid Postgres connection string`);
  }
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 1}`);
  }
}

export function validateRemoteSeedRequest(args, env = process.env) {
  const target = requireArg(
    args.target,
    'Missing required argument: --target <preview|staging>',
  );
  if (target !== 'preview' && target !== 'staging') {
    throw new Error(`Unsupported remote seed target: ${target}`);
  }

  const currentTier = env.ICONIC_ENV_TIER?.trim();
  if (currentTier === 'production') {
    throw new Error('Remote seeding is blocked when ICONIC_ENV_TIER=production.');
  }

  const databaseUrl = validateConnectionString(
    requireArg(
      resolveDatabaseUrl(args, env),
      'Missing required database URL. Set --db-url, SEED_DATABASE_URL, or DATABASE_URL.',
    ),
    'Database URL',
  );

  if (!fs.existsSync(args.seedFile)) {
    throw new Error(`Seed file does not exist: ${args.seedFile}`);
  }

  if (target === 'preview' && !args.freshBranch) {
    throw new Error(
      'Preview seeding requires --fresh-branch because seed.sql is non-idempotent.',
    );
  }

  if (target === 'staging' && !args.allowDestroy) {
    throw new Error(
      'Staging reseed requires --allow-destroy because replaying seed.sql is destructive.',
    );
  }

  return {
    target,
    databaseUrl,
    seedFile: args.seedFile,
    envValidationTarget: target,
    projectRef: env.SUPABASE_PROJECT_REF?.trim() || 'unknown',
    dryRun: args.dryRun,
  };
}

export function executeRemoteSeed(
  request,
  env = process.env,
  runner = run,
  processPath = process.execPath,
) {
  runner(processPath, [validateEnvScript, '--target', request.envValidationTarget], {
    env,
  });

  if (request.dryRun) {
    console.log(`[seed-remote] dry-run target=${request.target}`);
    console.log(`[seed-remote] project_ref=${request.projectRef}`);
    console.log(`[seed-remote] seed_file=${request.seedFile}`);
    console.log(
      '[seed-remote] command=psql -v ON_ERROR_STOP=1 -d <database_url> -f <seed_file>',
    );
    return;
  }

  runner(
    'psql',
    ['-v', 'ON_ERROR_STOP=1', '-d', request.databaseUrl, '-f', request.seedFile],
    {
      env,
    },
  );
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const request = validateRemoteSeedRequest(args, env);

  console.log(`[seed-remote] target=${request.target}`);
  console.log(`[seed-remote] project_ref=${request.projectRef}`);
  console.log(`[seed-remote] seed_file=${request.seedFile}`);
  console.log('[seed-remote] seed.sql is treated as a non-production full-load import.');

  executeRemoteSeed(request, env);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(
      `[seed-remote] ${error instanceof Error ? error.message : 'Unknown error occurred.'}`,
    );
    process.exit(1);
  }
}
