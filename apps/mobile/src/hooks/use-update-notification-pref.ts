import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queries';
import { supabase } from '@/lib/supabase/client';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

async function upsertNotificationPreference(
  orgId: string,
  profileId: string,
  prefKey: string,
  muted: boolean,
) {
  const now = new Date().toISOString();

  const existingPref = await supabase
    .from('notification_preferences')
    .select('channels')
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .eq('pref_key', prefKey)
    .is('deleted_at', null)
    .maybeSingle<{ channels: string[] | null }>();

  if (existingPref.error) throw new Error(existingPref.error.message);

  const channels =
    Array.isArray(existingPref.data?.channels) && existingPref.data.channels.length > 0
      ? existingPref.data.channels
      : ['push'];

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      org_id: orgId,
      profile_id: profileId,
      pref_key: prefKey,
      channels,
      muted,
      updated_at: now,
      updated_by: profileId,
    },
    { onConflict: 'org_id,profile_id,pref_key' },
  );
  if (error) throw new Error(error.message);
}

export function useUpdateNotificationPref() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  return useMutation({
    mutationFn: ({ prefKey, muted }: { prefKey: string; muted: boolean }) => {
      if (!orgId || !profileId) throw new Error('Not authenticated');
      return upsertNotificationPreference(orgId, profileId, prefKey, muted);
    },
    onSettled: () => {
      if (orgId && profileId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.notificationPrefs(orgId, profileId),
        });
      }
    },
  });
}
