import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyClassroomApkLibraries } from './verify-classroom-apk.mjs';
const libs = ['libzoom_util.so', 'libworklets.so', 'libreactnative.so'];
test('accepts a complete ARM classroom APK', () => {
  assert.doesNotThrow(() =>
    verifyClassroomApkLibraries(
      libs.map((name) => `lib/arm64-v8a/${name}`),
      'arm64-v8a',
    ),
  );
});
test('rejects the mixed ABI package that crashes Zoom on an x86 emulator', () => {
  const entries = [
    'lib/arm64-v8a/libzoom_util.so',
    'lib/x86_64/libworklets.so',
    'lib/x86_64/libreactnative.so',
  ];
  assert.throws(
    () => verifyClassroomApkLibraries(entries, 'x86_64'),
    /missing x86_64 libraries: libzoom_util.so/,
  );
});
test('catches a missing Worklets native dependency before launching the emulator app', () => {
  assert.throws(
    () =>
      verifyClassroomApkLibraries(
        ['lib/arm64-v8a/libzoom_util.so', 'lib/arm64-v8a/libreactnative.so'],
        'arm64-v8a',
      ),
    /libworklets.so/,
  );
});

test('rejects competing x86 binaries even when all ARM libraries are present', () => {
  assert.throws(
    () =>
      verifyClassroomApkLibraries(
        [...libs.map((name) => `lib/arm64-v8a/${name}`), 'lib/x86_64/libreactnative.so'],
        'arm64-v8a',
      ),
    /competing x86 libraries/,
  );
});
