import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api/http-client';
import { queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

async function upsertNotificationPreference(
  orgId: string,
  profileId: string,
  prefKey: string,
  muted: boolean,
) {
  const existing = await apiGet<Array<{ channels?: string[] | null }>>(
    '/notification-preferences',
    { orgId, profileId, prefKey },
  );
  const existingPref = existing[0];
  const channels =
    Array.isArray(existingPref?.channels) && existingPref.channels.length > 0
      ? existingPref.channels
      : ['push'];

  await apiPut('/notification-preferences', {
    orgId,
    profileId,
    prefKey,
    channels,
    muted,
  });
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
