import { useQuery } from '@tanstack/react-query';
import { fetchNotificationPreferences, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

export function useNotificationPrefs() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const orgId     = (account as Record<string, unknown> | undefined)?.org_id as string | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as string | undefined;

  return useQuery({
    queryKey: queryKeys.notificationPrefs(orgId ?? '', profileId ?? ''),
    queryFn: () => fetchNotificationPreferences(orgId!, profileId!),
    enabled: !!orgId && !!profileId,
  });
}
