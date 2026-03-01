import { describe, expect, it } from 'vitest';

import {
  enableChannelCommunications,
  getFlagsProviderData,
  isVercelFlagsSdkConfigured,
  webFlags,
} from './flags';

describe('web flags', () => {
  it('declares the channel communications flag with stable metadata', () => {
    expect(enableChannelCommunications.key).toBe('enable-channel-communications');
    expect(enableChannelCommunications.defaultValue).toBe(false);
    expect(webFlags.enableChannelCommunications).toBe(enableChannelCommunications);
  });

  it('does not require FLAGS env to load the catalog', () => {
    expect(isVercelFlagsSdkConfigured()).toBe(false);
  });

  it('builds provider data for flag discovery', async () => {
    const providerData = await getFlagsProviderData();

    expect(providerData).toBeTruthy();
    expect(JSON.stringify(providerData)).toContain('enable-channel-communications');
  });
});
