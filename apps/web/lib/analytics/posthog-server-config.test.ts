import { describe, expect, it } from 'vitest';

import { resolvePostHogServerConfig } from './posthog-server-config';

describe('resolvePostHogServerConfig', () => {
  it('returns null when no key is configured', () => {
    expect(resolvePostHogServerConfig({})).toBeNull();
  });

  it('prefers a dedicated server key', () => {
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

  it('falls back to public env values', () => {
    expect(
      resolvePostHogServerConfig({
        NEXT_PUBLIC_POSTHOG_KEY: 'phc_public_key',
      }),
    ).toEqual({
      apiKey: 'phc_public_key',
      apiHost: 'https://us.i.posthog.com',
    });
  });
});
