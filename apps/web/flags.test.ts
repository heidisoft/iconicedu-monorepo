import { describe, expect, it } from 'vitest';

import {
  enableChannelCommunications,
  enableMessageTypeComposer,
  enablePersonaAdd,
  enablePersonaSwitch,
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

  it('declares the message type composer flag with stable metadata', () => {
    expect(enableMessageTypeComposer.key).toBe('enable-message-type-composer');
    expect(enableMessageTypeComposer.defaultValue).toBe(false);
    expect(webFlags.enableMessageTypeComposer).toBe(enableMessageTypeComposer);
  });

  it('declares persona switch flag with stable metadata', () => {
    expect(enablePersonaSwitch.key).toBe('enable-persona-switch');
    expect(enablePersonaSwitch.defaultValue).toBe(false);
    expect(webFlags.enablePersonaSwitch).toBe(enablePersonaSwitch);
  });

  it('declares persona add flag with stable metadata', () => {
    expect(enablePersonaAdd.key).toBe('enable-persona-add');
    expect(enablePersonaAdd.defaultValue).toBe(false);
    expect(webFlags.enablePersonaAdd).toBe(enablePersonaAdd);
  });

  it('does not require FLAGS env to load the catalog', () => {
    expect(isVercelFlagsSdkConfigured()).toBe(false);
  });

  it('builds provider data for flag discovery', async () => {
    const providerData = await getFlagsProviderData();

    expect(providerData).toBeTruthy();
    expect(JSON.stringify(providerData)).toContain('enable-channel-communications');
    expect(JSON.stringify(providerData)).toContain('enable-message-type-composer');
    expect(JSON.stringify(providerData)).toContain('enable-persona-switch');
    expect(JSON.stringify(providerData)).toContain('enable-persona-add');
  });
});
