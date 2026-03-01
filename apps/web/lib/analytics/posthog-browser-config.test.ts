import { describe, expect, it } from 'vitest';

import { resolvePostHogBrowserConfig } from './posthog-browser-config';

describe('resolvePostHogBrowserConfig', () => {
  it('returns null when no public key is configured', () => {
    expect(resolvePostHogBrowserConfig({})).toBeNull();
  });

  it('uses NEXT_PUBLIC_POSTHOG_KEY when provided', () => {
    expect(
      resolvePostHogBrowserConfig({
        NEXT_PUBLIC_POSTHOG_KEY: 'phc_test_key',
        NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
      }),
    ).toEqual({
      apiKey: 'phc_test_key',
      apiHost: 'https://us.i.posthog.com',
      defaults: '2026-01-30',
    });
  });

  it('falls back to NEXT_PUBLIC_POSTHOG_TOKEN and default host', () => {
    expect(
      resolvePostHogBrowserConfig({
        NEXT_PUBLIC_POSTHOG_TOKEN: 'phc_token_key',
      }),
    ).toEqual({
      apiKey: 'phc_token_key',
      apiHost: 'https://us.i.posthog.com',
      defaults: '2026-01-30',
    });
  });
});
