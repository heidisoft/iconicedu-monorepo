export const platformFeatureFlagKeys = {
  enableMobileDirectMessageStart: 'enable-mobile-direct-message-start',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
