export const platformFeatureFlagKeys = {
  enableMobileDirectMessageStart: 'enable-mobile-direct-message-start',
  enableMobileOnboardingAddressSearch: 'enable-mobile-onboarding-address-search',
  enableMobileGoogleSignIn: 'enable-mobile-google-sign-in',
  enableMobileAppleSignIn: 'enable-mobile-apple-sign-in',
  sessionCompletionCarousel: 'session-completion-carousel',
  enableMessageDrafts: 'enable-message-drafts',
  enableMessageEdit: 'enable-message-edit',
  enableMobileMessageComposerParity: 'enable-mobile-message-composer-parity',
  enableMessageSendReliability: 'enable-message-send-reliability',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
