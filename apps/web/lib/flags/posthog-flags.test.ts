import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { evaluatePosthogBooleanFlag } from '@iconicedu/web/lib/flags/posthog-flags';

describe('evaluatePosthogBooleanFlag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.POSTHOG_FLAGS_KEY;
    delete process.env.POSTHOG_FLAGS_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    delete process.env.DEBUG_POSTHOG_FLAGS;
  });

  it('uses a separate project for development flags and ignores it in production', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.POSTHOG_KEY = 'phc_analytics';
    process.env.POSTHOG_HOST = 'https://analytics.example.com';
    process.env.POSTHOG_FLAGS_KEY = 'phc_flags';
    process.env.POSTHOG_FLAGS_HOST = 'https://flags.example.com';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ featureFlags: { 'enable-parent-referrals': true } }),
    } as Response);
    try {
      for (const environment of ['development', 'production']) {
        process.env.NODE_ENV = environment;
        await evaluatePosthogBooleanFlag({
          flagKey: 'enable-parent-referrals',
          distinctId: 'test-parent',
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

  it('returns the provider value when available', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          featureFlags: {
            'enable-message-type-composer': true,
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);
  });

  it('returns false when fetch fails or config is missing', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
  });

  it('returns false when provider throws', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network failure');
      }),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
  });

  it('returns false when PostHog config is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('coerces non-boolean provider values', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          featureFlags: {
            'enable-message-type-composer': 'variant-a',
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);
  });

  it('returns false for zero numeric provider values', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          featureFlags: {
            'enable-message-type-composer': 0,
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
  });

  it('does not emit debug logs when debug mode is disabled', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          featureFlags: {
            'enable-message-type-composer': true,
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('does not emit debug logs when debug mode is enabled', async () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';
    process.env.DEBUG_POSTHOG_FLAGS = 'true';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          featureFlags: {
            'enable-message-type-composer': 'variant-a',
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-message-type-composer',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(true);

    expect(infoSpy).not.toHaveBeenCalled();
  });
});
