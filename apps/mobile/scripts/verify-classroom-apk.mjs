import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Reject builds that compile successfully but cannot initialize the real native SDK. */
export function verifyClassroomApkLibraries(entries, abi) {
  const competing = entries.filter((entry) => /^lib\/x86(?:_64)?\//.test(entry));
  if (competing.length && abi.startsWith('arm')) {
    throw new Error(
      'Classroom APK contains competing x86 libraries; package ARM only so Android selects Zoom-compatible native dependencies.',
    );
  }
  const required = ['libzoom_util.so', 'libworklets.so', 'libreactnative.so'];
  const missing = required.filter(
    (library) => !entries.includes(`lib/${abi}/${library}`),
  );
  if (missing.length) {
    throw new Error(
      `Classroom APK is missing ${abi} libraries: ${missing.join(', ')}. Build and run on an ABI supported by the Zoom SDK (ARM), with every native dependency compiled for the same ARM ABI.`,
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , apk, abi] = process.argv;
  if (!apk || !abi) throw new Error('Usage: verify-classroom-apk.mjs <apk> <abi>');
  const entries = execFileSync('unzip', ['-Z', '-1', apk], { encoding: 'utf8' })
    .trim()
    .split('\n');
  verifyClassroomApkLibraries(entries, abi);
  console.log(
    `Classroom APK includes Zoom, Worklets and React Native libraries for ${abi}.`,
  );
}
