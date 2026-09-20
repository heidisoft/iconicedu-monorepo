import {
  getLocalMobileFeatureFlagFallback,
  mobileFeatureFlagKeys,
  parseBooleanFeatureFlag,
} from './feature-flags';

describe('mobile feature flags', () => {
  it('defaults direct message start rollout to off', async () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START;
    delete process.env.EXPO_PUBLIC_APP_ENV;

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(false);
  });

  it('enables direct message start rollout from an Expo public env flag', async () => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(true);
  });

  it('does not force direct message start on in local or preview app envs', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START;

    process.env.EXPO_PUBLIC_APP_ENV = 'local';
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(false);

    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(false);
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

  it('keeps the four messaging P0 flags off by default', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_DRAFTS;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_EDIT;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY;

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageDrafts),
    ).toBe(false);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageEdit),
    ).toBe(false);
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

  it('enables the four messaging P0 flags from their Expo public env flags', () => {
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_DRAFTS = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_EDIT = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY = 'true';
    process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY = 'true';

    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageDrafts),
    ).toBe(true);
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.enableMessageEdit),
    ).toBe(true);
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

    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_DRAFTS;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_EDIT;
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_MESSAGE_COMPOSER_PARITY;
    delete process.env.EXPO_PUBLIC_ENABLE_MESSAGE_SEND_RELIABILITY;
  });

  it('keeps the session completion carousel off unless explicitly enabled', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_SESSION_COMPLETION_CAROUSEL;
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.sessionCompletionCarousel),
    ).toBe(false);

    process.env.EXPO_PUBLIC_ENABLE_SESSION_COMPLETION_CAROUSEL = 'true';
    expect(
      getLocalMobileFeatureFlagFallback(mobileFeatureFlagKeys.sessionCompletionCarousel),
    ).toBe(true);
  });
});
