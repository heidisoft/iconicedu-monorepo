import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
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
  run('pnpm', [
    '--filter',
    'web',
    'exec',
    'playwright',
    'test',
    ...(mode === 'ui' ? webUI : integration).map((name) => `${name}.spec.ts`),
    '--workers=1',
    '--retries=0',
    // Runs against `next dev`, which compiles each route on first visit; CI runners
    // need more than the default 30s for that without hiding real failures behind retries.
    '--timeout=90000',
  ]);
} else if (mode === 'ui') {
  if (!process.env.NATIVE_SYNC_DEVICE_ID)
    throw new Error('NATIVE_SYNC_DEVICE_ID is required.');
  run(
    'maestro',
    [
      '--device',
      process.env.NATIVE_SYNC_DEVICE_ID,
      'test',
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
