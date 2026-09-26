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

  if (key === mobileFeatureFlagKeys.enableMobileAppleSignIn) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MOBILE_APPLE_SIGN_IN);
  }

  if (key === mobileFeatureFlagKeys.sessionCompletionCarousel) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_SESSION_COMPLETION_CAROUSEL,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMessageMarkUnread) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MESSAGE_MARK_UNREAD);
  }

  if (key === mobileFeatureFlagKeys.enableMessageReplyReference) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MESSAGE_REPLY_REFERENCE,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMobileLinkPreviews) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MOBILE_LINK_PREVIEWS);
  }

  if (key === mobileFeatureFlagKeys.enableNotificationConversationControls) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_NOTIFICATION_CONVERSATION_CONTROLS,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMessageListFormatting) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MESSAGE_LIST_FORMATTING,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMessageDrafts) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MESSAGE_DRAFTS);
  }

  if (key === mobileFeatureFlagKeys.enableMessageEdit) {
    return parseBooleanFeatureFlag(process.env.EXPO_PUBLIC_ENABLE_MESSAGE_EDIT);
  }

  if (key === mobileFeatureFlagKeys.enableMobileMessageComposerParity) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY,
    );
  }

  if (key === mobileFeatureFlagKeys.enableMessageSendReliability) {
    return parseBooleanFeatureFlag(
      process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY,
    );
  }

  return false;
}
