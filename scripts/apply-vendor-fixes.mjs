#!/usr/bin/env node
// Copies known-good fixed file content over specific files in node_modules,
// undoing upstream bugs/incompatibilities that pnpm install always resets.
//
// Why not `pnpm.patchedDependencies`: pnpm's own patch applier rejected both
// of these diffs with ERR_PNPM_PATCH_FAILED even though `git apply` accepted
// them cleanly — root cause not tracked down. Plain file copies sidestep
// that parser entirely.
//
// Remove each entry below once its upstream package ships a real fix.
//
// - expo-router@55.0.4: LinkPreviewNativeActionView.swift sets
//   UIMenu/UIAction.subtitle (iOS 16+ only) without the `@available` guard
//   used a few lines above for other iOS-16-only properties in the same
//   functions. Newer Xcode/Swift toolchains enforce this strictly and the
//   build fails; older ones didn't. Fix: wrap both assignments in
//   `if #available(iOS 16.0, *)`, matching the existing nearby guards.
// - @expo/cli@55.0.15: three spots resolve the iOS Simulator app by the
//   literal name "Simulator" via AppleScript/`open -a`. Xcode 27 renamed
//   that app to "DeviceHub" (bundle id com.apple.dt.Devices), so every one
//   of these lookups fails and `expo start`/`expo run:ios` refuse to run,
//   misreporting "Simulator is most likely not installed". Fix: try
//   "Simulator" first (stays correct on normal Xcode installs), fall back
//   to "DeviceHub" only when that fails.

import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixesDir = join(rootDir, 'scripts', 'vendor-fixes');

const fixes = [
  'expo-router/ios/LinkPreview/LinkPreviewNativeActionView.swift',
  '@expo/cli/build/src/start/doctor/apple/SimulatorAppPrerequisite.js',
  '@expo/cli/build/src/start/platforms/ios/ensureSimulatorAppRunning.js',
  '@expo/cli/build/src/start/platforms/ios/AppleDeviceManager.js',
];

let applied = 0;
for (const relativePath of fixes) {
  const source = join(fixesDir, relativePath);
  const target = join(rootDir, 'node_modules', relativePath);

  if (!existsSync(target)) {
    // Package not installed (e.g. a partial/filtered install) — skip quietly.
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  applied += 1;
}

if (applied > 0) {
  console.log(`[apply-vendor-fixes] Applied ${applied} vendor fix(es) to node_modules.`);
}
