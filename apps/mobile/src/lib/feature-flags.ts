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

export function getLocalMobileFeatureFlagFallback(key: MobileFeatureFlagKey): boolean {
  if (key === mobileFeatureFlagKeys.enableMobileOnboardingAddressSearch) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MOBILE_ONBOARDING_ADDRESS_SEARCH,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMobileDirectMessageStart) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMobileGoogleSignIn) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MOBILE_GOOGLE_SIGN_IN);
  }

  if (key === mobileFeatureFlagKeys.enableAnyVisibleClassSessionJoin) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_ANY_VISIBLE_CLASS_SESSION_JOIN,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMobileAppleSignIn) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MOBILE_APPLE_SIGN_IN);
  }

  return false;
}
