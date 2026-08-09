import { afterEach, describe, expect, it, vi } from 'vitest';

const evaluatePosthogBooleanFlag = vi.fn();

vi.mock('@iconicedu/web/lib/flags/posthog-flags', () => ({
  evaluatePosthogBooleanFlag: (...args: unknown[]) => evaluatePosthogBooleanFlag(...args),
}));

import {
  enableChannelCommunications,
  enableMarketingSitePages,
  enableMessageTypeComposer,
  enableMobileAppleSignIn,
  enableMobileDirectMessageStart,
  enableMobileGoogleSignIn,
  enableWebTurnstile,
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
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
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

  it('declares the mobile direct message start flag with stable metadata', () => {
    expect(enableMobileDirectMessageStart.key).toBe('enable-mobile-direct-message-start');
    expect(enableMobileDirectMessageStart.defaultValue).toBe(false);
    expect(webFlags.enableMobileDirectMessageStart).toBe(enableMobileDirectMessageStart);
  });

  it('declares the mobile social sign-in flags with stable metadata', () => {
    expect(enableMobileGoogleSignIn.key).toBe('enable-mobile-google-sign-in');
    expect(enableMobileGoogleSignIn.defaultValue).toBe(false);
    expect(webFlags.enableMobileGoogleSignIn).toBe(enableMobileGoogleSignIn);

    expect(enableMobileAppleSignIn.key).toBe('enable-mobile-apple-sign-in');
    expect(enableMobileAppleSignIn.defaultValue).toBe(false);
    expect(webFlags.enableMobileAppleSignIn).toBe(enableMobileAppleSignIn);
  });

  it('declares the marketing site pages flag with stable metadata', () => {
    expect(enableMarketingSitePages.key).toBe('enable-marketing-site-pages');
    expect(enableMarketingSitePages.defaultValue).toBe(false);
    expect(webFlags.enableMarketingSitePages).toBe(enableMarketingSitePages);
  });

  it('declares the web Turnstile flag with stable metadata', () => {
    expect(enableWebTurnstile.key).toBe('enable-web-turnstile');
    expect(enableWebTurnstile.defaultValue).toBe(false);
    expect(webFlags.enableWebTurnstile).toBe(enableWebTurnstile);
  });

  it('does not require FLAGS env to load the catalog', () => {
    expect(isVercelFlagsSdkConfigured()).toBe(false);
  });

  it('reports configured when PostHog key and host are provided', () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';

    expect(isVercelFlagsSdkConfigured()).toBe(true);
  });

  it('reports configured when PostHog is provided in preview', () => {
    process.env.VERCEL_ENV = 'preview';
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

  it('evaluates flags via PostHog in preview', async () => {
    process.env.VERCEL_ENV = 'preview';
    evaluatePosthogBooleanFlag.mockResolvedValueOnce(false);

    await expect(
      (
        enableChannelCommunications as unknown as {
          decide: (input: {
            entities?: { profileId?: string | null };
          }) => Promise<boolean>;
        }
      ).decide({ entities: { profileId: 'profile-1' } }),
    ).resolves.toBe(false);
    expect(evaluatePosthogBooleanFlag).toHaveBeenCalledWith({
      flagKey: 'enable-channel-communications',
      distinctId: 'profile-1',
    });
  });

  it('builds provider data for flag discovery', async () => {
    const providerData = await getFlagsProviderData();

    expect(providerData).toBeTruthy();
    expect(JSON.stringify(providerData)).toContain('enable-channel-communications');
    expect(JSON.stringify(providerData)).toContain('enable-marketing-site-pages');
    expect(JSON.stringify(providerData)).toContain('enable-message-type-composer');
    expect(JSON.stringify(providerData)).toContain('enable-mobile-direct-message-start');
  });
});
