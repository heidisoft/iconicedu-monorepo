import {
  apiFeatureFlagKeys,
  evaluateApiBooleanFlag,
} from '@iconicedu/api/lib/flags/posthog-openfeature';

describe('evaluateApiBooleanFlag', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.APP_ENV;
    delete process.env.API_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.CI;
  });

  it('returns the PostHog flag value through OpenFeature', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        featureFlags: {
          [apiFeatureFlagKeys.enableMobileDirectMessageStart]: true,
        },
      }),
    } as Response);

    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableMobileDirectMessageStart,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);
  });

  it('defaults off when PostHog config is missing', async () => {
    process.env.NODE_ENV = 'test';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableMobileDirectMessageStart,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('defaults on in local and preview environments without calling PostHog', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    process.env.APP_ENV = 'local';
    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableMobileDirectMessageStart,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    process.env.APP_ENV = '';
    process.env.VERCEL_ENV = 'preview';
    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableMobileDirectMessageStart,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
