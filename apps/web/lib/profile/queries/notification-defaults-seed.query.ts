import type { SupabaseClient } from '@supabase/supabase-js';

type SignupDefaultPreference = {
  prefKey: string;
  channels: string[];
};

const SIGNUP_DEFAULT_NOTIFICATION_PREFERENCES: SignupDefaultPreference[] = [
  { prefKey: 'payment.reminder', channels: ['push', 'email'] },
  { prefKey: 'message.posted', channels: ['push', 'email'] },
  { prefKey: 'reaction.added', channels: ['push', 'email'] },
  { prefKey: 'dm.posted', channels: ['push', 'email'] },
  { prefKey: 'class.session.rescheduled', channels: ['push', 'email'] },
  { prefKey: 'class.session.canceled', channels: ['push', 'email'] },
  { prefKey: 'session.reminder.sent', channels: ['push', 'email'] },
];

export async function seedSignupDefaultNotificationPreferences(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  const rows = SIGNUP_DEFAULT_NOTIFICATION_PREFERENCES.map((item) => ({
    org_id: orgId,
    profile_id: profileId,
    pref_key: item.prefKey,
    channels: item.channels,
    muted: false,
  }));

  return supabase
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'org_id,profile_id,pref_key' });
}
