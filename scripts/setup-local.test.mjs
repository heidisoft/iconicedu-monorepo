import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const sourceScript = path.join(repoRoot, 'scripts', 'setup-local.sh');
const nodeBin = process.execPath;

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

function createTempRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-local-test-'));
  fs.mkdirSync(path.join(tempRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'apps', 'web'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'apps', 'mobile'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'apps', 'api'), { recursive: true });
  fs.copyFileSync(sourceScript, path.join(tempRoot, 'scripts', 'setup-local.sh'));
  return tempRoot;
}

function createBinDir(tempRoot, options = {}) {
  const binDir = path.join(tempRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  writeExecutable(
    path.join(binDir, 'node'),
    `#!/usr/bin/env bash
exec "${nodeBin}" "$@"
`,
  );

  writeExecutable(
    path.join(binDir, 'pnpm'),
    `#!/usr/bin/env bash
echo "pnpm should not be called in --sync-env mode" >&2
exit 97
`,
  );

  writeExecutable(
    path.join(binDir, 'docker'),
    `#!/usr/bin/env bash
echo "docker should not be called in --sync-env mode" >&2
exit 96
`,
  );

  const statusOutput =
    options.statusOutput ??
    `Stopped services: [test]\n${JSON.stringify(
      {
        API_URL: 'http://127.0.0.1:54321',
        DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        JWT_SECRET: 'local-jwt-secret',
        PUBLISHABLE_KEY: 'sb_publishable_local',
        ANON_KEY: 'anon-local',
        SECRET_KEY: 'sb_secret_local',
        SERVICE_ROLE_KEY: 'service-role-local',
        MAILPIT_URL: 'http://127.0.0.1:54324',
        REST_URL: 'http://127.0.0.1:54321/rest/v1',
        GRAPHQL_URL: 'http://127.0.0.1:54321/graphql/v1',
        MCP_URL: 'http://127.0.0.1:54321/mcp',
        STORAGE_S3_URL: 'http://127.0.0.1:54321/storage/v1/s3',
        STUDIO_URL: 'http://127.0.0.1:54323',
      },
      null,
      2,
    )}`;

  writeExecutable(
    path.join(binDir, 'supabase'),
    `#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then
  echo "supabase version test"
  exit 0
fi
if [[ "$1" == "status" && "$2" == "--output" && "$3" == "json" ]]; then
  cat <<'EOF'
${statusOutput}
EOF
  exit 0
fi
if [[ "$1" == "start" ]]; then
  echo "supabase start should not be called in --sync-env mode" >&2
  exit 98
fi
echo "unexpected supabase args: $*" >&2
exit 99
`,
  );

  return binDir;
}

function runSync(tempRoot, binDir) {
  return execFileSync('bash', ['scripts/setup-local.sh', '--sync-env'], {
    cwd: tempRoot,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
    },
    encoding: 'utf8',
  });
}

test('sync-env updates only targeted keys and preserves unrelated content', () => {
  const tempRoot = createTempRepo();
  const binDir = createBinDir(tempRoot);

  fs.writeFileSync(
    path.join(tempRoot, 'apps', 'web', '.env.local'),
    [
      '# keep this comment',
      'UNRELATED_WEB=value',
      'NEXT_PUBLIC_SUPABASE_URL=https://old-web.example.com',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=old-anon',
      'SUPABASE_SERVICE_ROLE_KEY=old-service',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(tempRoot, 'apps', 'mobile', '.env'),
    ['UNRELATED_MOBILE=value', 'EXPO_PUBLIC_SUPABASE_ANON_KEY=old-mobile-anon', ''].join('\n'),
  );
  fs.writeFileSync(
    path.join(tempRoot, 'apps', 'api', '.env'),
    ['# api comment', 'DATABASE_URL=old-db', 'INTERNAL_REMINDERS_TOKEN_API=existing-reminder', '']
      .join('\n'),
  );

  const output = runSync(tempRoot, binDir);

  const webEnv = fs.readFileSync(path.join(tempRoot, 'apps', 'web', '.env.local'), 'utf8');
  const mobileEnv = fs.readFileSync(path.join(tempRoot, 'apps', 'mobile', '.env'), 'utf8');
  const apiEnv = fs.readFileSync(path.join(tempRoot, 'apps', 'api', '.env'), 'utf8');

  assert.match(webEnv, /# keep this comment/);
  assert.match(webEnv, /UNRELATED_WEB=value/);
  assert.match(webEnv, /NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(webEnv, /NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-local/);
  assert.match(webEnv, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local/);
  assert.match(webEnv, /SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(webEnv, /SUPABASE_SERVICE_ROLE_KEY=service-role-local/);
  assert.match(webEnv, /NEXT_PUBLIC_APP_URL=http:\/\/127\.0\.0\.1:3000/);
  assert.match(webEnv, /INTERNAL_REMINDERS_TOKEN=existing-reminder/);
  assert.match(webEnv, /INTERNAL_ACTIVITY_FEED_TOKEN=[0-9a-f]{64}/);

  assert.match(mobileEnv, /UNRELATED_MOBILE=value/);
  assert.match(mobileEnv, /EXPO_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(mobileEnv, /EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-local/);

  assert.match(apiEnv, /# api comment/);
  assert.match(apiEnv, /DATABASE_URL=postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(apiEnv, /DIRECT_URL=postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(apiEnv, /SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(apiEnv, /SUPABASE_SERVICE_ROLE_KEY=service-role-local/);
  assert.match(apiEnv, /JWT_SECRET=local-jwt-secret/);
  assert.match(apiEnv, /INTERNAL_REMINDERS_TOKEN_API=existing-reminder/);

  assert.match(output, /Env sync complete!/);
  assert.match(output, /Mobile local Supabase URL is pinned to http:\/\/127\.0\.0\.1:54321 by choice\./);
});

test('sync-env does not add NEXT_PUBLIC_SUPABASE_ANON_KEY when publishable key is present and anon key is absent', () => {
  const tempRoot = createTempRepo();
  const binDir = createBinDir(tempRoot);

  fs.writeFileSync(
    path.join(tempRoot, 'apps', 'web', '.env.local'),
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=old-publishable', ''].join('\n'),
  );

  runSync(tempRoot, binDir);

  const webEnv = fs.readFileSync(path.join(tempRoot, 'apps', 'web', '.env.local'), 'utf8');
  assert.match(webEnv, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local/);
  assert.doesNotMatch(webEnv, /^NEXT_PUBLIC_SUPABASE_ANON_KEY=/m);
});

test('sync-env is idempotent across repeated runs', () => {
  const tempRoot = createTempRepo();
  const binDir = createBinDir(tempRoot);

  runSync(tempRoot, binDir);
  const firstWeb = fs.readFileSync(path.join(tempRoot, 'apps', 'web', '.env.local'), 'utf8');
  const firstMobile = fs.readFileSync(path.join(tempRoot, 'apps', 'mobile', '.env'), 'utf8');
  const firstApi = fs.readFileSync(path.join(tempRoot, 'apps', 'api', '.env'), 'utf8');

  runSync(tempRoot, binDir);
  const secondWeb = fs.readFileSync(path.join(tempRoot, 'apps', 'web', '.env.local'), 'utf8');
  const secondMobile = fs.readFileSync(path.join(tempRoot, 'apps', 'mobile', '.env'), 'utf8');
  const secondApi = fs.readFileSync(path.join(tempRoot, 'apps', 'api', '.env'), 'utf8');

  assert.equal(secondWeb, firstWeb);
  assert.equal(secondMobile, firstMobile);
  assert.equal(secondApi, firstApi);
  assert.equal((secondWeb.match(/^INTERNAL_ACTIVITY_FEED_TOKEN=/gm) ?? []).length, 1);
  assert.equal((secondApi.match(/^INTERNAL_REMINDERS_TOKEN_API=/gm) ?? []).length, 1);
});

test('sync-env fails clearly when required supabase status values are missing', () => {
  const tempRoot = createTempRepo();
  const binDir = createBinDir(tempRoot, {
    statusOutput: JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    }),
  });

  assert.throws(
    () => runSync(tempRoot, binDir),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /Missing required Supabase status value: JWT_SECRET/);
      return true;
    },
  );
});
