import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const local = JSON.parse(
  execFileSync('supabase', ['status', '--output', 'json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
for (const [key, protocol] of [
  ['API_URL', 'http:'],
  ['DB_URL', 'postgresql:'],
]) {
  const url = new URL(local[key]);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !(key === 'DB_URL' ? ['postgres:', protocol] : [protocol]).includes(url.protocol)
  )
    throw new Error('Audience E2E refuses hosted services');
}
const apiUrl = 'http://127.0.0.1:3101',
  webUrl = 'http://127.0.0.1:3100';
for (const url of [apiUrl, webUrl]) {
  let busy = false;
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    busy = true;
  } catch {}
  if (busy) throw new Error(`Test port already in use: ${new URL(url).port}`);
}
const artifacts = mkdtempSync(resolve(tmpdir(), 'iconicedu-audiences-'));
console.log(`Private synthetic test artifacts: ${artifacts}`);
const env = {
  ...process.env,
  APP_ENV: 'local',
  VERCEL_ENV: 'development',
  NEXT_PUBLIC_VERCEL_ENV: 'development',
  SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
  PORT: '3101',
  DATABASE_URL: local.DB_URL,
  DIRECT_URL: local.DB_URL,
  SUPABASE_URL: local.API_URL,
  SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: local.JWT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
  NEXT_PUBLIC_API_URL: apiUrl,
  API_URL: apiUrl,
  ENABLE_CHANNEL_COMMUNICATIONS: 'true',
  POSTHOG_KEY: '',
  NEXT_PUBLIC_POSTHOG_KEY: '',
  SENTRY_DSN: '',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  AUDIENCE_E2E_LOCAL: '1',
  AUDIENCE_API_URL: apiUrl,
  PLAYWRIGHT_BASE_URL: webUrl,
  PLAYWRIGHT_SKIP_WEBSERVER: '1',
};
const children = [];
function start(args, name) {
  const fd = openSync(resolve(artifacts, `${name}.log`), 'w', 0o600);
  const child = spawn('pnpm', args, {
    cwd: root,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  closeSync(fd);
  children.push(child);
  return child;
}
async function ready(url, child, expected) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('A test server stopped. Inspect private artifacts.');
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).status === expected)
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Test server startup timed out');
}
const stop = () => {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const api = start(['--filter', 'api', 'dev'], 'api');
  const web = start(
    [
      '--filter',
      'web',
      'exec',
      'next',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3100',
    ],
    'web',
  );
  await Promise.all([
    ready(`${apiUrl}/onboarding/status`, api, 401),
    ready(`${webUrl}/login`, web, 200),
  ]);
  const test = spawn(
    'pnpm',
    [
      '--filter',
      'web',
      'exec',
      'playwright',
      'test',
      'e2e/message-audience-roles.local.spec.ts',
      '--workers=1',
      '--retries=0',
      ...process.argv.slice(2).filter((arg) => arg !== '--'),
      '--output',
      resolve(artifacts, 'playwright'),
    ],
    { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.push(test);
  const testLog = openSync(resolve(artifacts, 'playwright.log'), 'w', 0o600);
  const redact = (line) =>
    line
      .replaceAll(local.SERVICE_ROLE_KEY, '[redacted]')
      .replaceAll(local.ANON_KEY, '[redacted]')
      .replace(/Bearer\s+\S+/g, 'Bearer [redacted]')
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[redacted JWT]');
  for (const stream of [test.stdout, test.stderr]) {
    let buffered = '';
    stream.on('data', (chunk) => {
      writeSync(testLog, chunk);
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop();
      for (const line of lines) process.stdout.write(redact(line) + '\n');
    });
    stream.on('end', () => {
      if (buffered) process.stdout.write(redact(buffered));
    });
  }

  const code = await new Promise((resolve, reject) => {
    test.on('close', resolve);
    test.on('error', reject);
  });
  closeSync(testLog);
  if (code !== 0) process.exitCode = 1;
} finally {
  stop();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
