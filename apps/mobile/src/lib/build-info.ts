import ConstantsDefault from 'expo-constants';
import * as Updates from 'expo-updates';

const Constants = ConstantsDefault as unknown as {
  expoConfig?: {
    name?: string;
    version?: string;
    runtimeVersion?: string;
    ios?: { buildNumber?: string };
    android?: { versionCode?: number };
    extra?: ConfigExtra;
  };
  nativeAppVersion?: string | null;
  nativeBuildVersion?: string | null;
};

type ConfigExtra = {
  appEnv?: unknown;
  easBuildId?: unknown;
  easBuildProfile?: unknown;
  gitCommit?: unknown;
};

export type MobileBuildInfo = {
  appName: string;
  version: string;
  nativeBuildVersion: string | null;
  runtimeVersion: string | null;
  channel: string | null;
  appEnv: string | null;
  easBuildId: string | null;
  easBuildProfile: string | null;
  gitCommit: string | null;
  updateId: string | null;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function shortId(value: string | null, length = 8): string | null {
  return value ? value.slice(0, length) : null;
}

export function getMobileBuildInfo(): MobileBuildInfo {
  const extra = (Constants.expoConfig?.extra ?? {}) as ConfigExtra;
  const updates = Updates as unknown as Record<string, unknown>;
  const runtimeVersion =
    stringOrNull(updates.runtimeVersion) ??
    stringOrNull(Constants.expoConfig?.runtimeVersion);

  return {
    appName: Constants.expoConfig?.name ?? 'ICONIC Academy',
    version:
      stringOrNull(Constants.nativeAppVersion) ??
      stringOrNull(Constants.expoConfig?.version) ??
      '0.1.0',
    nativeBuildVersion:
      stringOrNull(Constants.nativeBuildVersion) ??
      stringOrNull(Constants.expoConfig?.ios?.buildNumber) ??
      (typeof Constants.expoConfig?.android?.versionCode === 'number'
        ? String(Constants.expoConfig.android.versionCode)
        : null),
    runtimeVersion,
    channel: stringOrNull(updates.channel),
    appEnv: stringOrNull(extra.appEnv),
    easBuildId: shortId(stringOrNull(extra.easBuildId)),
    easBuildProfile: stringOrNull(extra.easBuildProfile),
    gitCommit: shortId(stringOrNull(extra.gitCommit), 7),
    updateId: shortId(stringOrNull(updates.updateId)),
  };
}

export function formatBuildFingerprint(info: MobileBuildInfo): string | null {
  return info.updateId ? `update ${info.updateId}` : null;
}
