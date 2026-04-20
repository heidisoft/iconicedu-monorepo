import { describe, expect, it, vi } from 'vitest';

import { seedSignupDefaultNotificationPreferences } from '@iconicedu/web/lib/profile/queries/notification-defaults-seed.query';

describe('seedSignupDefaultNotificationPreferences', () => {
  it('upserts all signup default preferences for the profile', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as unknown as Parameters<
      typeof seedSignupDefaultNotificationPreferences
    >[0];

    await seedSignupDefaultNotificationPreferences(supabase, 'org-1', 'profile-1');

    expect(from).toHaveBeenCalledWith('notification_preferences');
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          org_id: 'org-1',
          profile_id: 'profile-1',
          pref_key: 'payment.reminder',
          channels: ['push', 'email'],
          muted: false,
        }),
        expect.objectContaining({
          org_id: 'org-1',
          profile_id: 'profile-1',
          pref_key: 'system.notice',
          channels: ['push', 'email', 'sms'],
          muted: false,
        }),
      ]),
      { onConflict: 'org_id,profile_id,pref_key' },
    );

    const rows = upsert.mock.calls[0]?.[0] as Array<{ pref_key: string }>;
    expect(rows).toHaveLength(12);
    expect(rows.map((row) => row.pref_key)).toEqual(
      expect.arrayContaining(['reaction.added', 'session.reminder.sent', 'dm.posted']),
    );
  });
});
