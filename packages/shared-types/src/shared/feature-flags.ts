export const platformFeatureFlagKeys = {
  enableMobileDirectMessageStart: 'enable-mobile-direct-message-start',
  enableMobileOnboardingAddressSearch: 'enable-mobile-onboarding-address-search',
  enableMobileGoogleSignIn: 'enable-mobile-google-sign-in',
  enableMobileAppleSignIn: 'enable-mobile-apple-sign-in',
  sessionCompletionCarousel: 'session-completion-carousel',
  enableAiRefine: 'enable-ai-refine',
  enableAiSuggestedReplies: 'enable-ai-suggested-replies',
  enableMessagePinning: 'enable-message-pinning',
  enableMessageSearch: 'enable-message-search',
  enableScheduledSend: 'enable-scheduled-send',
  enableMessageMarkUnread: 'enable-message-mark-unread',
  enableMessageReplyReference: 'enable-message-reply-reference',
  enableMobileLinkPreviews: 'enable-mobile-link-previews',
  enableNotificationConversationControls: 'enable-notification-conversation-controls',
  enableMessageListFormatting: 'enable-message-list-formatting',
  enableMessageDrafts: 'enable-message-drafts',
  enableMessageEdit: 'enable-message-edit',
  enableMobileMessageComposerParity: 'enable-mobile-message-composer-parity',
  enableMessageSendReliability: 'enable-message-send-reliability',
  enableSessionCompletionVerifiedDuration: 'enable-session-completion-verified-duration',
  enableSessionCompletionDisputeDetails: 'enable-session-completion-dispute-details',
  enableOrgAiProviderSettings: 'enable-org-ai-provider-settings',
  mobileMinAppVersion: 'mobile-min-app-version',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
