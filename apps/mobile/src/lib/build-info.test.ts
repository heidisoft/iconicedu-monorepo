import { formatBuildFingerprint, type MobileBuildInfo } from './build-info';

describe('build-info', () => {
  it('formats a compact build fingerprint', () => {
    const info: MobileBuildInfo = {
      appName: 'ICONIC Academy',
      version: '0.2.0',
      nativeBuildVersion: '42',
      runtimeVersion: '2.0.0',
      channel: 'preview',
      appEnv: 'preview',
      easBuildId: 'build-12',
      easBuildProfile: 'preview',
      gitCommit: 'abcdef1',
      updateId: 'update-1',
    };

    expect(formatBuildFingerprint(info)).toBe(
      'preview · channel preview · runtime 2.0.0 · commit abcdef1 · update update-1 · build build-12',
    );
  });

  it('returns null when there is no diagnostic metadata', () => {
    expect(
      formatBuildFingerprint({
        appName: 'ICONIC Academy',
        version: '0.2.0',
        nativeBuildVersion: '42',
        runtimeVersion: null,
        channel: null,
        appEnv: null,
        easBuildId: null,
        easBuildProfile: null,
        gitCommit: null,
        updateId: null,
      }),
    ).toBeNull();
  });
});
