import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const appId = 'com.heidisoft.iconicedu';

export function requireLocalUrl(value, protocols = ['http:']) {
  const url = new URL(value);
  if (
    !protocols.includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error(
      'Auth E2E only supports loopback services; hosted environments are forbidden.',
    );
  }
  return url;
}
export function requireTestEmail(email) {
  if (!/^maestro-auth-[a-z0-9-]+@example\.test$/.test(email))
    throw new Error('Not a disposable auth E2E account.');
}
export function parseLocalStatus(status) {
  for (const name of [
    'API_URL',
    'INBUCKET_URL',
    'DB_URL',
    'ANON_KEY',
    'SERVICE_ROLE_KEY',
  ]) {
    if (!status[name])
      throw new Error(
        `Local Supabase status is missing ${name}. Start the local Supabase stack.`,
      );
  }
  requireLocalUrl(status.API_URL);
  requireLocalUrl(status.INBUCKET_URL);
  requireLocalUrl(status.DB_URL, ['postgres:', 'postgresql:']);
  return status;
}

export async function cleanupTestMailbox(mailUrl, email, request = fetch) {
  requireLocalUrl(mailUrl);
  requireTestEmail(email);
  const options = () => ({ signal: AbortSignal.timeout(2000) });
  const inbox = await request(
    `${mailUrl}/api/v1/mailbox/${encodeURIComponent(email.split('@')[0])}`,
    { ...options(), method: 'DELETE' },
  );
  if (inbox.ok) return;
  if (![404, 405].includes(inbox.status))
    throw new Error('Unable to clean up the local test mailbox.');
  const result = await request(
    `${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    options(),
  );
  if (!result.ok) throw new Error('Unable to search the local test mailbox.');
  const messages = await result.json();
  const ids = [
    ...new Set(
      (messages.messages ?? [])
        .filter((message) => message.To?.some((recipient) => recipient.Address === email))
        .map((message) => message.ID)
        .filter(Boolean),
    ),
  ];
  // Mailpit interprets an empty ID list as delete-all: never send one.
  if (!ids.length) return;
  const deleted = await request(`${mailUrl}/api/v1/messages`, {
    ...options(),
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
  if (!deleted.ok) throw new Error('Unable to delete the local test messages.');
}

function start(args, env, log, children) {
  const fd = openSync(log, 'w', 0o600);
  const child = spawn('pnpm', args, {
    cwd: root,
    env,
    stdio: ['ignore', fd, fd],
    detached: true,
  });
  closeSync(fd);
  children.push(child);
  return child;
}
async function ready(url, child, expectedStatus, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('A test server stopped during startup. See the local artifacts.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status === expectedStatus) return;
    } catch {
      /* The owned test process is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test server startup timed out. See the local artifacts.');
}
async function unused(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(500) });
  } catch {
    return;
  }
  throw new Error(
    `Test port is already in use: ${new URL(url).port}. Existing servers will not be reused or stopped.`,
  );
}

async function run() {
  execFileSync('maestro', ['--version'], { stdio: 'ignore' });
  const devices = JSON.parse(
    execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], {
      encoding: 'utf8',
    }),
  );
  const sourceSimulator = Object.entries(devices.devices)
    .flatMap(([runtime, devices]) => devices.map((device) => ({ ...device, runtime })))
    .find(
      (device) => device.state === 'Booted' && !device.name.startsWith('ICONIC Auth E2E'),
    );
  let simulator;
  if (!sourceSimulator)
    throw new Error(
      'Boot an iOS simulator with the development client installed before running auth E2E.',
    );
  const appBundle = execFileSync(
    'xcrun',
    ['simctl', 'get_app_container', sourceSimulator.udid, appId, 'app'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const local = parseLocalStatus(
    JSON.parse(
      execFileSync('supabase', ['status', '--output', 'json'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ),
  );
  const email = `maestro-auth-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  requireTestEmail(email);
  const apiUrl = 'http://127.0.0.1:3101';
  const metroUrl = 'http://127.0.0.1:8082';
  await unused(apiUrl);
  await unused(metroUrl);
  const artifacts = mkdtempSync(resolve(tmpdir(), 'iconicedu-auth-e2e-'));
  const children = [];
  const stop = () => {
    for (const child of children) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Already stopped. */
      }
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const env = {
    ...process.env,
    PORT: '3101',
    DATABASE_URL: local.DB_URL,
    DIRECT_URL: local.DB_URL,
    SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
    SUPABASE_JWT_SECRET: local.JWT_SECRET ?? '',
    EXPO_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_SUPABASE_URL: local.API_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
    EXPO_PUBLIC_APP_ENV: 'development',
    EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
    EXPO_PUBLIC_POSTHOG_KEY: '',
    POSTHOG_KEY: '',
    SENTRY_DSN: '',
    REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
  };
  console.log(`Auth E2E artifacts (local synthetic accounts only): ${artifacts}`);
  try {
    const udid = execFileSync(
      'xcrun',
      [
        'simctl',
        'create',
        `ICONIC Auth E2E ${randomUUID().slice(0, 8)}`,
        sourceSimulator.deviceTypeIdentifier,
        sourceSimulator.runtime,
      ],
      { encoding: 'utf8' },
    ).trim();
    simulator = { udid };
    execFileSync('xcrun', ['simctl', 'boot', udid], { stdio: 'ignore' });
    execFileSync('xcrun', ['simctl', 'bootstatus', udid, '-b'], {
      stdio: 'ignore',
      timeout: 120000,
    });
    execFileSync('xcrun', ['simctl', 'install', udid, appBundle], { stdio: 'ignore' });
    // Disable only Expo's developer-tool tutorial, never application onboarding/auth.
    for (const [key, value] of [
      ['EXDevMenuIsOnboardingFinished', 'true'],
      ['EXDevMenuShowsAtLaunch', 'false'],
      ['EXDevMenuShowFloatingActionButton', 'false'],
    ]) {
      execFileSync(
        'xcrun',
        ['simctl', 'spawn', udid, 'defaults', 'write', appId, key, '-bool', value],
        { stdio: 'ignore' },
      );
    }
    const api = start(
      ['--filter', 'api', 'dev'],
      env,
      resolve(artifacts, 'api.log'),
      children,
    );
    const metroEnv = { ...env };
    for (const key of [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'DATABASE_URL',
      'DIRECT_URL',
    ])
      delete metroEnv[key];
    const metro = start(
      [
        '--filter',
        'mobile',
        'exec',
        'expo',
        'start',
        '--dev-client',
        '--lan',
        '--port',
        '8082',
      ],
      metroEnv,
      resolve(artifacts, 'metro.log'),
      children,
    );
    await Promise.all([
      ready(`${apiUrl}/onboarding/status`, api, 401),
      ready(`${metroUrl}/status`, metro, 200),
    ]);
    execFileSync('xcrun', [
      'simctl',
      'spawn',
      simulator.udid,
      'defaults',
      'write',
      appId,
      'RCT_jsLocation',
      '-string',
      '127.0.0.1:8082',
    ]);
    const maestroArgs = [
      '--device',
      simulator.udid,
      'test',
      '-e',
      `APP_ID=${appId}`,
      '-e',
      `TEST_EMAIL=${email}`,
      '-e',
      `MAIL_URL=${local.INBUCKET_URL.replace(/\/$/, '')}`,
      '-e',
      `RUNTIME_URL=${metroUrl}`,
      '-e',
      `DEV_CLIENT_URL=exp+iconicedu-mobile://expo-development-client/?url=${encodeURIComponent(metroUrl)}`,
      '-e',
      `BIRTH_YEAR=${new Date().getFullYear() - 10}`,
      '--test-output-dir',
      resolve(artifacts, 'maestro'),
      'apps/mobile/.maestro/auth/auth.yaml',
    ];
    const fd = openSync(resolve(artifacts, 'maestro.log'), 'w', 0o600);
    const result = await new Promise((resolveExit) => {
      const child = spawn('maestro', maestroArgs, {
        cwd: root,
        detached: true,
        stdio: ['ignore', fd, fd],
      });
      closeSync(fd);
      children.push(child);
      child.on('exit', (code) => resolveExit(code));
      child.on('error', () => resolveExit(1));
    });
    if (result !== 0)
      throw new Error('Maestro auth flows failed. Inspect the private local artifacts.');
    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('id,onboarding_completed_at')
      .eq('email', email)
      .single();
    assert.ifError(accountError);
    assert.ok(account.onboarding_completed_at, 'Signup must complete onboarding');
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select(
        'first_name,last_name,display_name,city,region,postal_code,country_code,timezone',
      )
      .eq('account_id', account.id)
      .eq('kind', 'guardian')
      .single();
    assert.ifError(profileError);
    assert.equal(profile.first_name, 'Maestro');
    assert.equal(profile.last_name, 'Family');
    assert.equal(profile.display_name, 'E2E Parent');
    assert.equal(profile.country_code, 'US');
    assert.equal(profile.region, 'New York');
    assert.equal(profile.city, 'New York');
    assert.equal(profile.postal_code, '10001');
    assert.equal(profile.timezone, 'America/New_York');
    const { data: childLink, error: linkError } = await admin
      .from('family_links')
      .select('child_account_id')
      .eq('guardian_account_id', account.id)
      .single();
    assert.ifError(linkError);
    const { data: childProfile, error: childProfileError } = await admin
      .from('profiles')
      .select('id')
      .eq('account_id', childLink.child_account_id)
      .eq('kind', 'child')
      .single();
    assert.ifError(childProfileError);
    const { data: child, error: childError } = await admin
      .from('child_profiles')
      .select('birth_year')
      .eq('profile_id', childProfile.id)
      .single();
    assert.ifError(childError);
    assert.equal(child.birth_year, new Date().getFullYear() - 10);
    console.log(
      'PASS: real OTP signup, full onboarding, invalid OTP, persisted session, existing-user login, logout, and persisted profile values.',
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    for (const child of children) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Already stopped. */
      }
    }
    if (simulator) {
      try {
        execFileSync('xcrun', ['simctl', 'shutdown', simulator.udid], {
          stdio: 'ignore',
        });
      } catch {
        /* Already shut down. */
      }
      execFileSync('xcrun', ['simctl', 'delete', simulator.udid], { stdio: 'ignore' });
    }
    // Cleanup is deliberately scoped to this exact generated email and its child links.
    requireTestEmail(email);
    const { data: users, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error('Unable to clean up the disposable local auth account.');
    const user = users.users.find((user) => user.email === email);
    if (user) {
      const { data: account } = await admin
        .from('accounts')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (account) {
        const { data: links } = await admin
          .from('family_links')
          .select('child_account_id')
          .eq('guardian_account_id', account.id);
        const childIds = (links ?? [])
          .map((link) => link.child_account_id)
          .filter(Boolean);
        if (childIds.length) {
          const { error } = await admin.from('accounts').delete().in('id', childIds);
          if (error) throw new Error('Unable to clean up disposable child accounts.');
        }
      }
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw new Error('Unable to remove the disposable local auth user.');
    }
    await cleanupTestMailbox(local.INBUCKET_URL, email);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
