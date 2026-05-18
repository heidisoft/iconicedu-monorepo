import { afterEach, describe, expect, it, vi } from 'vitest';

const evaluatePosthogBooleanFlag = vi.fn();

vi.mock('@iconicedu/web/lib/flags/posthog-flags', () => ({
  evaluatePosthogBooleanFlag: (...args: unknown[]) => evaluatePosthogBooleanFlag(...args),
}));

import {
  enableAdminActivityFeedAudit,
  enableAdminReports,
  enableChannelCommunications,
  enableClassScheduleStaffCancel,
  enableClassScheduleStaffEdit,
  enableMessageTypeComposer,
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

  it('declares the admin reports flag with stable metadata', () => {
    expect(enableAdminReports.key).toBe('enable-admin-reports');
    expect(enableAdminReports.defaultValue).toBe(true);
    expect(webFlags.enableAdminReports).toBe(enableAdminReports);
  });

  it('declares the admin activity feed audit flag with stable metadata', () => {
    expect(enableAdminActivityFeedAudit.key).toBe('enable-admin-activity-feed-audit');
    expect(enableAdminActivityFeedAudit.defaultValue).toBe(false);
    expect(webFlags.enableAdminActivityFeedAudit).toBe(enableAdminActivityFeedAudit);
  });

  it('declares the message type composer flag with stable metadata', () => {
    expect(enableMessageTypeComposer.key).toBe('enable-message-type-composer');
    expect(enableMessageTypeComposer.defaultValue).toBe(false);
    expect(webFlags.enableMessageTypeComposer).toBe(enableMessageTypeComposer);
  });

  it('declares the class schedule cancel flag with stable metadata', () => {
    expect(enableClassScheduleStaffCancel.key).toBe('enable-class-schedule-staff-cancel');
    expect(enableClassScheduleStaffCancel.defaultValue).toBe(true);
    expect(webFlags.enableClassScheduleStaffCancel).toBe(enableClassScheduleStaffCancel);
  });

  it('declares the class schedule edit flag with stable metadata', () => {
    expect(enableClassScheduleStaffEdit.key).toBe('enable-class-schedule-staff-edit');
    expect(enableClassScheduleStaffEdit.defaultValue).toBe(false);
    expect(webFlags.enableClassScheduleStaffEdit).toBe(enableClassScheduleStaffEdit);
  });

  it('does not require FLAGS env to load the catalog', () => {
    expect(isVercelFlagsSdkConfigured()).toBe(false);
  });

  it('reports configured when PostHog key and host are provided', () => {
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';

    expect(isVercelFlagsSdkConfigured()).toBe(true);
  });

  it('does not require PostHog when running in preview', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.POSTHOG_KEY = 'phc_test';
    process.env.POSTHOG_HOST = 'https://posthog.example.com';

    expect(isVercelFlagsSdkConfigured()).toBe(false);
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

  it('enables flags by default in preview without calling PostHog', async () => {
    process.env.VERCEL_ENV = 'preview';

    await expect(
      (
        enableChannelCommunications as unknown as {
          decide: (input: {
            entities?: { profileId?: string | null };
          }) => Promise<boolean>;
        }
      ).decide({ entities: { profileId: 'profile-1' } }),
    ).resolves.toBe(true);
    expect(evaluatePosthogBooleanFlag).not.toHaveBeenCalled();
  });

  it('builds provider data for flag discovery', async () => {
    const providerData = await getFlagsProviderData();

    expect(providerData).toBeTruthy();
    expect(JSON.stringify(providerData)).toContain('enable-admin-reports');
    expect(JSON.stringify(providerData)).toContain('enable-admin-activity-feed-audit');
    expect(JSON.stringify(providerData)).toContain('enable-channel-communications');
    expect(JSON.stringify(providerData)).toContain('enable-class-schedule-staff-cancel');
    expect(JSON.stringify(providerData)).toContain('enable-class-schedule-staff-edit');
    expect(JSON.stringify(providerData)).toContain('enable-message-type-composer');
  });
});
