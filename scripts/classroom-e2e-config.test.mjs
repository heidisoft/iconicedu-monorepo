import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrySources, readClassroomE2EConfig } from './classroom-e2e-config.mjs';

function check(mutate = () => {}) {
  const config = {
    dedicatedTestEnvironment: true,
    webOrigin: 'https://classroom.example.test',
    journeys: entrySources.flatMap((source) =>
      (source === 'sessions' ? [true] : [true, false]).flatMap((scheduled) =>
        [true, false].map((existingSession) => ({
          source,
          scheduled,
          existingSession,
          webPath: '/test/home',
          nativePath: '/test/home',
          joinSelector: '[data-testid="join-test-class"]',
          nativeJoinLabel: 'Join test class',
          displayName: 'Test teacher',
        })),
      ),
    ),
  };
  mutate(config);
  const directory = mkdtempSync(join(tmpdir(), 'classroom-config-'));
  const path = join(directory, 'config.json');
  try {
    writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
    return readClassroomE2EConfig(path);
  } finally {
    rmSync(directory, { recursive: true });
  }
}
test('requires all ten supported source/schedule/session combinations', () => {
  assert.equal(check().journeys.length, 10);
  assert.throws(() => check((c) => c.journeys.pop()), /Missing sessions/);
  assert.throws(() => check((c) => c.journeys.push(c.journeys[0])), /Duplicate journey/);
});
test('rejects unconfirmed environments and secret-bearing entry URLs', () => {
  assert.throws(
    () =>
      check((c) => {
        c.dedicatedTestEnvironment = false;
      }),
    /dedicatedTestEnvironment/,
  );
  for (const path of [
    '//foreign.test/home',
    '/home#invite=synthetic',
    '/home?token=synthetic',
  ])
    assert.throws(() =>
      check((c) => {
        c.journeys[0].webPath = path;
      }),
    );
  assert.throws(() =>
    check((c) => {
      c.journeys[0].nativePath = '/home#invite=synthetic';
    }),
  );
});
test('rejects incomplete selectors rather than clicking an arbitrary Join button', () => {
  assert.throws(
    () =>
      check((c) => {
        c.journeys[0].joinSelector = '';
      }),
    /joinSelector/,
  );
});
