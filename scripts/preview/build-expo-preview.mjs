import {
  parseArgs,
  requireArg,
  runCommand,
  readJsonFile,
  writeJsonFile,
  toSummaryError,
} from './utils.mjs';

const DEFAULT_STATUS_FILE = '.tmp/preview-status.json';

async function upsertExpoEnv(name, value) {
  const args = [
    'exec',
    'eas',
    'env:update',
    'preview',
    '--scope',
    'project',
    '--variable-name',
    name,
    '--variable-environment',
    'preview',
    '--value',
    value,
    '--non-interactive',
  ];

  const update = await runCommand('pnpm', args, {
    cwd: 'apps/mobile',
    tolerateFailure: true,
  });

  if (update.ok) {
    return;
  }

  await runCommand(
    'pnpm',
    [
      'exec',
      'eas',
      'env:create',
      'preview',
      '--scope',
      'project',
      '--name',
      name,
      '--value',
      value,
      '--visibility',
      name.startsWith('EXPO_PUBLIC_') ? 'plaintext' : 'sensitive',
      '--non-interactive',
    ],
    { cwd: 'apps/mobile' },
  );
}

async function triggerBuild() {
  const result = await runCommand(
    'pnpm',
    [
      'exec',
      'eas',
      'build',
      '--profile',
      'preview',
      '--platform',
      'all',
      '--json',
      '--non-interactive',
    ],
    { cwd: 'apps/mobile' },
  );

  const parsed = JSON.parse(result.stdout);
  const builds = Array.isArray(parsed) ? parsed : [parsed];
  const urls = builds
    .map((item) => item?.artifacts?.buildUrl ?? item?.buildDetailsPageUrl ?? item?.url)
    .filter(Boolean);

  return {
    status: 'triggered',
    urls,
    raw: builds,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireArg(args, 'pr');
  const supabaseUrl = requireArg(args, 'supabase-url');
  const anonKey = requireArg(args, 'anon-key');
  const statusFile = args['status-file'] ?? DEFAULT_STATUS_FILE;

  const summary = await readJsonFile(statusFile);

  try {
    await upsertExpoEnv('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);
    await upsertExpoEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', anonKey);

    const build = await triggerBuild();
    summary.expo = {
      requested: true,
      triggered: true,
      status: build.status,
      urls: build.urls,
      note: 'Preview build triggered with the PR-specific Supabase preview branch credentials.',
    };
  } catch (error) {
    summary.expo = {
      requested: true,
      triggered: false,
      status: 'failed',
      note: toSummaryError(error),
    };
  }

  summary.updatedAt = new Date().toISOString();
  await writeJsonFile(statusFile, summary);
}

await main();
