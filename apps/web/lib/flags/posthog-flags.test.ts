import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { evaluatePosthogBooleanFlag } from '@iconicedu/web/lib/flags/posthog-flags';

describe('evaluatePosthogBooleanFlag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
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
            'enable-persona-add': 'variant-a',
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-persona-add',
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
            'enable-persona-add': 0,
          },
        }),
      })),
    );

    await expect(
      evaluatePosthogBooleanFlag({
        flagKey: 'enable-persona-add',
        distinctId: 'profile-1',
      }),
    ).resolves.toBe(false);
  });
});
