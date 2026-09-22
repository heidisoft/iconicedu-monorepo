export const platformFeatureFlagKeys = {
  enableMobileDirectMessageStart: 'enable-mobile-direct-message-start',
  enableMobileOnboardingAddressSearch: 'enable-mobile-onboarding-address-search',
  enableMobileGoogleSignIn: 'enable-mobile-google-sign-in',
  enableMobileAppleSignIn: 'enable-mobile-apple-sign-in',
  sessionCompletionCarousel: 'session-completion-carousel',
  enableMessagePinning: 'enable-message-pinning',
  enableMessageSearch: 'enable-message-search',
  enableScheduledSend: 'enable-scheduled-send',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
