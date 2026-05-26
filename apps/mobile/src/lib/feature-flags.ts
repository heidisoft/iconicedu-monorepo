import { platformFeatureFlagKeys } from '@iconicedu/shared-types';

export const mobileFeatureFlagKeys = platformFeatureFlagKeys;

export type MobileFeatureFlagKey =
  (typeof mobileFeatureFlagKeys)[keyof typeof mobileFeatureFlagKeys];

export function parseBooleanFeatureFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'off'
  ) {
    return false;
  }
  return true;
}

export function isLocalOrPreviewMobileEnvironment(): boolean {
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV ?? '').trim().toLowerCase();
  return appEnv === 'local' || appEnv === 'preview';
}

export function getLocalMobileFeatureFlagFallback(key: MobileFeatureFlagKey): boolean {
  if (isLocalOrPreviewMobileEnvironment()) {
    return true;
  }

  if (key === mobileFeatureFlagKeys.enableMobileDirectMessageStart) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START,
    );
  }

  return false;
}
