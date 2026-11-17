import {
  getLocalMobileFeatureFlagFallback,
  mobileFeatureFlagKeys,
  parseBooleanFeatureFlag,
} from './feature-flags';

describe('mobile feature flags', () => {
  it('enables channel communications only from its Expo public env flag', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_CHANNEL_COMMUNICATIONS;
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableChannelCommunications,
      ),
    ).toBe(false);

    process.env.EXPO_PUBLIC_ENABLE_CHANNEL_COMMUNICATIONS = 'true';
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableChannelCommunications,
      ),
    ).toBe(true);

    delete process.env.EXPO_PUBLIC_ENABLE_CHANNEL_COMMUNICATIONS;
  });

  it('defaults onboarding address search rollout to off', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_ONBOARDING_ADDRESS_SEARCH;
    process.env.EXPO_PUBLIC_APP_ENV = 'local';

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileOnboardingAddressSearch,
      ),
    ).toBe(false);
  });

  it('enables onboarding address search rollout from an Expo public env flag', () => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_ONBOARDING_ADDRESS_SEARCH = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileOnboardingAddressSearch,
      ),
    ).toBe(true);
  });

  it('defaults mobile social sign-in rollouts to off outside local and preview', () => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_GOOGLE_SIGN_IN;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_APPLE_SIGN_IN;

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileGoogleSignIn),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileAppleSignIn),
    ).toBe(false);
  });

  it('enables mobile social sign-in rollouts from Expo public env flags', () => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_GOOGLE_SIGN_IN = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_APPLE_SIGN_IN = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileGoogleSignIn),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileAppleSignIn),
    ).toBe(true);
  });

  it('normalizes PostHog boolean-style values', () => {
    expect(parseBooleanFeatureFlag(true)).toBe(true);
    expect(parseBooleanFeatureFlag('on')).toBe(true);
    expect(parseBooleanFeatureFlag(1)).toBe(true);
    expect(parseBooleanFeatureFlag('')).toBe(false);
  });

  it('keeps the remaining messaging P0 flags off by default', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY;

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileMessageComposerParity,
      ),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageSendReliability,
      ),
    ).toBe(false);
  });

  it('enables the remaining messaging P0 flags from their Expo public env flags', () => {
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileMessageComposerParity,
      ),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageSendReliability,
      ),
    ).toBe(true);

    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY;
  });

  it('keeps message pinning, search, and scheduled send off by default', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_PINNING;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEARCH;
    delete process.env.EXPO_PUBLIC_ENABLE_SCHEDULED_SEND;

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessagePinning),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageSearch),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableScheduledSend),
    ).toBe(false);
  });

  it('enables message pinning, search, and scheduled send from Expo public env flags', () => {
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_PINNING = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEARCH = 'true';
    process.env.EXPO_PUBLIC_ENABLE_SCHEDULED_SEND = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessagePinning),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageSearch),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableScheduledSend),
    ).toBe(true);

    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_PINNING;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEARCH;
    delete process.env.EXPO_PUBLIC_ENABLE_SCHEDULED_SEND;
  });

  it('keeps the P1 messaging flags off by default', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_MARK_UNREAD;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_REPLY_REFERENCE;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_LINK_PREVIEWS;
    delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATION_CONVERSATION_CONTROLS;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_LIST_FORMATTING;

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageMarkUnread),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageReplyReference,
      ),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileLinkPreviews),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableNotificationConversationControls,
      ),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageListFormatting,
      ),
    ).toBe(false);
  });

  it('enables the P1 messaging flags from their Expo public env vars', () => {
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_MARK_UNREAD = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_REPLY_REFERENCE = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_LINK_PREVIEWS = 'true';
    process.env.EXPO_PUBLIC_ENABLE_NOTIFICATION_CONVERSATION_CONTROLS = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_LIST_FORMATTING = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageMarkUnread),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageReplyReference,
      ),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMobileLinkPreviews),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableNotificationConversationControls,
      ),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMessageListFormatting,
      ),
    ).toBe(true);

    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_MARK_UNREAD;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_REPLY_REFERENCE;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_LINK_PREVIEWS;
    delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATION_CONVERSATION_CONTROLS;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_LIST_FORMATTING;
  });
});
