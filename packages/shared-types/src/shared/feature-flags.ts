export const platformFeatureFlagKeys = {
  enableClassroomCalls: 'classroom-calls',
  enableClassroomWhiteboard: 'classroom-whiteboard',
  enableClassroomMeetingSettings: 'classroom-meeting-settings',
  enableMobileOnboardingAddressSearch: 'enable-mobile-onboarding-address-search',
  enableMobileGoogleSignIn: 'enable-mobile-google-sign-in',
  enableMobileAppleSignIn: 'enable-mobile-apple-sign-in',
  enableMessagePinning: 'enable-message-pinning',
  enableMessageSearch: 'enable-message-search',
  enableScheduledSend: 'enable-scheduled-send',
  enableMessageMarkUnread: 'enable-message-mark-unread',
  enableMessageReplyReference: 'enable-message-reply-reference',
  enableMobileLinkPreviews: 'enable-mobile-link-previews',
  enableNotificationConversationControls: 'enable-notification-conversation-controls',
  enableMessageListFormatting: 'enable-message-list-formatting',
  enableMobileMessageComposerParity: 'enable-mobile-message-composer-parity',
  enableMessageSendReliability: 'enable-message-send-reliability',
  enableChannelCommunications: 'enable-channel-communications',
  mobileMinAppVersion: 'mobile-min-app-version',
} as const;

export type PlatformFeatureFlagKey =
  (typeof platformFeatureFlagKeys)[keyof typeof platformFeatureFlagKeys];
