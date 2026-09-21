export const platformFeatureFlagKeys = {
  enableMobileDirectMessageStart: 'enable-mobile-direct-message-start',
  enableMobileOnboardingAddressSearch: 'enable-mobile-onboarding-address-search',
  enableMobileGoogleSignIn: 'enable-mobile-google-sign-in',
  enableMobileAppleSignIn: 'enable-mobile-apple-sign-in',
  sessionCompletionCarousel: 'session-completion-carousel',
  enableMessageMarkUnread: 'enable-message-mark-unread',
  enableMessageReplyReference: 'enable-message-reply-reference',
  enableMobileLinkPreviews: 'enable-mobile-link-previews',
  enableNotificationConversationControls: 'enable-notification-conversation-controls',
  enableMessageListFormatting: 'enable-message-list-formatting',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
