import {
  apiFeatureFlagKeys,
  evaluateApiBooleanFlag,
} from '@iconicedu/api/lib/flags/posthog-openfeature';

describe('evaluateApiBooleanFlag', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.POSTHOG_FLAGS_KEY;
    delete process.env.POSTHOG_FLAGS_HOST;
    delete process.env.APP_ENV;
    delete process.env.API_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.CI;
    delete process.env.SUPABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
  });

  it('uses a separate project for development flags and ignores it in production', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.POSTHOG_KEY = 'phc_analytics';
    process.env.POSTHOG_HOST = 'https://analytics.example.com';
    process.env.POSTHOG_FLAGS_KEY = 'phc_flags';
    process.env.POSTHOG_FLAGS_HOST = 'https://flags.example.com';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ featureFlags: { 'enable-parent-referrals': true } }),
    } as Response);
    try {
      for (const environment of ['development', 'production']) {
        process.env.NODE_ENV = environment;
        await evaluateApiBooleanFlag({
          flagKey: 'enable-parent-referrals',
          distinctId: 'test-parent',
          allowLocalOverride: false,
        });
        const [url, init] = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!;
        expect(String(url)).toContain(
          environment === 'production'
            ? 'https://analytics.example.com'
            : 'https://flags.example.com',
        );
        expect(JSON.parse(init!.body as string).api_key).toBe(
          environment === 'production' ? 'phc_analytics' : 'phc_flags',
        );
      }
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

  it('returns the PostHog flag value through OpenFeature', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        featureFlags: {
          [apiFeatureFlagKeys.enableChannelCommunications]: true,
        },
      }),
    } as Response);

    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableChannelCommunications,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);
  });

  it('defaults off when PostHog config is missing', async () => {
    process.env.NODE_ENV = 'test';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableChannelCommunications,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('defaults on when local service URLs are configured', async () => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableChannelCommunications,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('defaults on in local and preview environments without calling PostHog', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    process.env.APP_ENV = 'local';
    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableChannelCommunications,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    process.env.APP_ENV = '';
    process.env.VERCEL_ENV = 'preview';
    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableChannelCommunications,
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it.each(['local', 'preview'])(
    'honors strict flag defaults in %s instead of the environment bypass',
    async (environment) => {
      process.env.APP_ENV = environment;
      delete process.env.POSTHOG_KEY;
      await expect(
        evaluateApiBooleanFlag({
          flagKey: apiFeatureFlagKeys.enableParentReferrals,
          distinctId: 'anonymous',
          allowLocalOverride: false,
        }),
      ).resolves.toBe(false);
    },
  );
  it('evaluates the provider for a strict flag even when local services are configured', async () => {
    process.env.APP_ENV = 'local';
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.POSTHOG_KEY = 'phc_test';
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        featureFlags: { [apiFeatureFlagKeys.enableParentReferrals]: true },
      }),
    } as Response);
    await expect(
      evaluateApiBooleanFlag({
        flagKey: apiFeatureFlagKeys.enableParentReferrals,
        distinctId: 'anonymous',
        allowLocalOverride: false,
      }),
    ).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
