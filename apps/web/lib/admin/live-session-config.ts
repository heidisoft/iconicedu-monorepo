import type {
  ChannelLiveSessionConfigVM,
  LiveSessionModeVM,
  LiveSessionProviderVM,
} from '@iconicedu/shared-types';

export const DEFAULT_ADMIN_LIVE_SESSION_CONFIG: ChannelLiveSessionConfigVM = {
  enabled: false,
  provider: 'daily',
  mode: 'video',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProvider(value: unknown): value is LiveSessionProviderVM {
  return value === 'daily' || value === 'zoom' || value === 'jitsi' || value === 'custom';
}

function isMode(value: unknown): value is LiveSessionModeVM {
  return value === 'video' || value === 'audio';
}

export function parseAdminLiveSessionConfig(value: unknown): ChannelLiveSessionConfigVM | null {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !isProvider(value.provider)) {
    return null;
  }

  return {
    enabled: value.enabled,
    provider: value.provider,
    mode: isMode(value.mode) ? value.mode : null,
  };
}

export function getAdminLiveSessionConfig(
  value: unknown,
): ChannelLiveSessionConfigVM {
  return parseAdminLiveSessionConfig(value) ?? DEFAULT_ADMIN_LIVE_SESSION_CONFIG;
}

export function toStoredLiveSessionConfig(
  value: ChannelLiveSessionConfigVM | null | undefined,
): ChannelLiveSessionConfigVM | null {
  if (!value?.enabled) {
    return null;
  }

  return {
    enabled: true,
    provider: value.provider,
    mode: value.mode ?? 'video',
  };
}
