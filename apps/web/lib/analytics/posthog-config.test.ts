import { describe, expect, it } from 'vitest';

import {
  resolvePostHogBrowserConfig,
  resolvePostHogServerConfig,
} from './posthog-config';

describe('resolvePostHogBrowserConfig', () => {
  it('returns null when no public key is configured', () => {
    expect(resolvePostHogBrowserConfig({})).toBeNull();
  });

  it('uses NEXT_PUBLIC_POSTHOG_KEY and explicit host', () => {
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

  it('falls back to the default host when NEXT_PUBLIC_POSTHOG_HOST is absent', () => {
    expect(
      resolvePostHogBrowserConfig({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test_key' }),
    ).toEqual({
      apiKey: 'phc_test_key',
      apiHost: 'https://us.i.posthog.com',
      defaults: '2026-01-30',
    });
  });
});

describe('resolvePostHogServerConfig', () => {
  it('returns null when no key is configured', () => {
    expect(resolvePostHogServerConfig({})).toBeNull();
  });

  it('prefers the dedicated server key and includes the personal API key', () => {
    expect(
      resolvePostHogServerConfig({
        POSTHOG_KEY: 'phc_server_key',
        POSTHOG_HOST: 'https://us.i.posthog.com',
        POSTHOG_PERSONAL_API_KEY: 'phx_personal_key',
      }),
    ).toEqual({
      apiKey: 'phc_server_key',
      apiHost: 'https://us.i.posthog.com',
      personalApiKey: 'phx_personal_key',
    });
  });

  it('falls back to the public key and default host', () => {
    expect(
      resolvePostHogServerConfig({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_public_key' }),
    ).toEqual({
      apiKey: 'phc_public_key',
      apiHost: 'https://us.i.posthog.com',
    });
  });
});
