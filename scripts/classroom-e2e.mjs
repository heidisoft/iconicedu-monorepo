import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readClassroomE2EConfig } from './classroom-e2e-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [mode = 'ui', platform = 'web'] = process.argv.slice(2);
const webUI = [
  'live-session-setup',
  'zoom-meeting-responsive',
  'meeting-picture-in-picture',
  'zoom-media-stability',
  'meeting-roles-audio',
  'classroom-meeting-settings',
  'screen-annotations',
  'recording-share-compositor',
  'focused-fullscreen',
];
const integration = [
  'meeting-link-admission',
  'meeting-tablet-recovery',
  'classroom-whiteboard',
  'collaborative-annotations',
  'native-whiteboard-sync',
  'whiteboard-laser',
  'whiteboard-mobile-toolbar',
  'whiteboard-quick-styles',
];
function run(command, args, cwd = root, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
async function waitForServer(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Web dev server did not start at ${url}`);
}
/**
 * `next dev` compiles each route on its first visit, which on CI runners can outlast a
 * test step or navigation assertion. Compile every fixture route once, then run the
 * suite against that server. The fixtures are dev-only, so a production build is not an
 * option.
 */
async function runWithPreparedWebServer(args) {
  const port = process.env.CLASSROOM_E2E_WEB_PORT ?? '3000';
  const baseURL = `http://127.0.0.1:${port}`;
  const server = spawn('pnpm', ['--filter', 'web', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, PORT: port },
  });
  try {
    await waitForServer(baseURL);
    const fixtures = readdirSync(join(root, 'apps/web/app/(public)/visual-test'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/visual-test/${entry.name}`);
    for (const route of fixtures) {
      const started = Date.now();
      const response = await fetch(`${baseURL}${route}`, {
        signal: AbortSignal.timeout(300_000),
      });
      console.log(
        `Prepared ${route} (${response.status}) in ${Math.round((Date.now() - started) / 1000)}s`,
      );
    }
    const result = spawnSync(
      'pnpm',
      ['--filter', 'web', 'exec', 'playwright', 'test', ...args],
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: baseURL,
          PLAYWRIGHT_SKIP_WEBSERVER: '1',
        },
      },
    );
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // The server already exited.
    }
  }
}
if (
  !['ui', 'integration', 'live'].includes(mode) ||
  !['web', 'ios', 'android'].includes(platform)
)
  throw new Error(
    'Usage: node scripts/classroom-e2e.mjs ui|integration|live web|ios|android',
  );
if (mode === 'live') {
  const config = readClassroomE2EConfig(process.env.CLASSROOM_E2E_CONFIG);
  if (platform === 'web') {
    if (!process.env.PLAYWRIGHT_AUTH_STATE)
      throw new Error('PLAYWRIGHT_AUTH_STATE is required for signed-in live journeys.');
    run(
      'pnpm',
      [
        '--filter',
        'web',
        'exec',
        'playwright',
        'test',
        'classroom-live-journeys.spec.ts',
        '--workers=1',
        '--retries=0',
        '--headed',
      ],
      root,
      {
        PLAYWRIGHT_BASE_URL: config.webOrigin,
        PLAYWRIGHT_SKIP_WEBSERVER: '1',
      },
    );
  } else {
    if (!process.env.NATIVE_SYNC_DEVICE_ID)
      throw new Error('NATIVE_SYNC_DEVICE_ID must select the signed-in test device.');
    for (const journey of config.journeys) {
      console.log(
        `Live ${platform}: ${journey.source}, scheduled=${journey.scheduled}, existing session=${journey.existingSession}`,
      );
      const artifacts = mkdtempSync(join(tmpdir(), 'classroom-live-'));
      const args = [
        '--device',
        process.env.NATIVE_SYNC_DEVICE_ID,
        'test',
        '--test-output-dir',
        artifacts,
        '--debug-output',
        artifacts,
        '-e',
        `NATIVE_PATH=${journey.nativePath.replace(/^\//, '')}`,
        '-e',
        `JOIN_LABEL=${journey.nativeJoinLabel}`,
        '-e',
        `DISPLAY_NAME=${journey.displayName}`,
        '.maestro/classroom-live-source.yaml',
      ];
      const result = spawnSync('maestro', args, {
        cwd: `${root}apps/mobile`,
        stdio: 'inherit',
        env: process.env,
      });
      const cleanup = spawnSync(
        'maestro',
        [
          '--device',
          process.env.NATIVE_SYNC_DEVICE_ID,
          'test',
          '--test-output-dir',
          artifacts,
          '--debug-output',
          artifacts,
          '.maestro/classroom-live-cleanup.yaml',
        ],
        { cwd: `${root}apps/mobile`, stdio: 'inherit', env: process.env },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
      if (cleanup.status !== 0)
        throw new Error(
          'Live meeting cleanup failed; inspect the test device before retrying.',
        );
    }
  }
} else if (platform === 'web') {
  const status = await runWithPreparedWebServer([
    ...(mode === 'ui' ? webUI : integration).map((name) => `${name}.spec.ts`),
    '--workers=1',
    '--retries=0',
    // Headroom for slow CI runners without hiding real failures behind retries.
    '--timeout=90000',
  ]);
  process.exit(status);
} else if (mode === 'ui') {
  if (!process.env.NATIVE_SYNC_DEVICE_ID)
    throw new Error('NATIVE_SYNC_DEVICE_ID is required.');
  run(
    'maestro',
    [
      '--device',
      process.env.NATIVE_SYNC_DEVICE_ID,
      'test',
      '-e',
      `METRO_PORT=${process.env.METRO_PORT ?? '8085'}`,
      ...[
        'ui',
        'join-failure',
        'moderation',
        'student',
        'link-entry',
        'deep-links',
        'export',
        'annotations',
        'media-controls',
        'whiteboard-write',
        'presentation',
        'presentation-transition',
        ...(platform === 'android' ? ['picture-in-picture'] : []),
      ].map((name) => `.maestro/classroom-${name}.yaml`),
    ],
    `${root}apps/mobile`,
  );
} else {
  if (!process.env.NATIVE_SYNC_DEVICE_ID)
    throw new Error('NATIVE_SYNC_DEVICE_ID is required for web/native collaboration.');
  run('pnpm', [
    '--filter',
    'web',
    'exec',
    'playwright',
    'test',
    'native-whiteboard-sync.spec.ts',
    'collaborative-annotations.spec.ts',
    '--workers=1',
  ]);
}
