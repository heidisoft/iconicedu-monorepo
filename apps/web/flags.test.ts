import { afterEach, describe, expect, it, vi } from 'vitest';

const evaluatePosthogBooleanFlag = vi.fn();

vi.mock('@iconicedu/web/lib/flags/posthog-flags', () => ({
  evaluatePosthogBooleanFlag: (...args: unknown[]) => evaluatePosthogBooleanFlag(...args),
}));

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
  afterEach(() => {
    evaluatePosthogBooleanFlag.mockReset();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

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

  it('reports configured when PostHog key and host are provided', () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';

    expect(isVercelFlagsSdkConfigured()).toBe(true);
  });

  it('evaluates channel communications via PostHog using anonymous fallback', async () => {
    evaluatePosthogBooleanFlag.mockResolvedValueOnce(true);

    await expect(
      (
        enableChannelCommunications as unknown as {
          decide: (input: {
            entities?: { profileId?: string | null };
          }) => Promise<boolean>;
        }
      ).decide({ entities: {} }),
    ).resolves.toBe(true);
    expect(evaluatePosthogBooleanFlag).toHaveBeenCalledWith({
      flagKey: 'enable-channel-communications',
      distinctId: 'anonymous',
    });
  });

  it('evaluates persona switch via PostHog using profileId', async () => {
    evaluatePosthogBooleanFlag.mockResolvedValueOnce(true);

    await expect(
      (
        enablePersonaSwitch as unknown as {
          decide: (input: {
            entities?: { profileId?: string | null };
          }) => Promise<boolean>;
        }
      ).decide({ entities: { profileId: 'profile-42' } }),
    ).resolves.toBe(true);
    expect(evaluatePosthogBooleanFlag).toHaveBeenCalledWith({
      flagKey: 'enable-persona-switch',
      distinctId: 'profile-42',
    });
  });

  it('evaluates persona add via PostHog using profileId', async () => {
    evaluatePosthogBooleanFlag.mockResolvedValueOnce(false);

    await expect(
      (
        enablePersonaAdd as unknown as {
          decide: (input: {
            entities?: { profileId?: string | null };
          }) => Promise<boolean>;
        }
      ).decide({ entities: { profileId: 'profile-99' } }),
    ).resolves.toBe(false);
    expect(evaluatePosthogBooleanFlag).toHaveBeenCalledWith({
      flagKey: 'enable-persona-add',
      distinctId: 'profile-99',
    });
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
