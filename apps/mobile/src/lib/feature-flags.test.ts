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

  it('defaults direct message start rollout to on in local and preview app envs', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_MOBILE_DIRECT_MESSAGE_START;

    process.env.EXPO_PUBLIC_APP_ENV = 'local';
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(true);

    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    expect(
      getLocalMobileFeatureFlagFallback(
        mobileFeatureFlagKeys.enableMobileDirectMessageStart,
      ),
    ).toBe(true);
  });

  it('normalizes PostHog boolean-style values', () => {
    expect(parseBooleanFeatureFlag(true)).toBe(true);
    expect(parseBooleanFeatureFlag('on')).toBe(true);
    expect(parseBooleanFeatureFlag(1)).toBe(true);
    expect(parseBooleanFeatureFlag('')).toBe(false);
  });
});
