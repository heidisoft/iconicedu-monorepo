import { useQuery } from '@tanstack/react-query';
import { fetchNotificationPreferences, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';

export function useNotificationPrefs() {
  const { data: account } = useAccount();
  const acc = account as Record<string, unknown> | undefined;
  const orgId = acc?.org_id as string | undefined;
  const profileId = acc?.default_profile_id as string | undefined;

  return useQuery({
    queryKey: queryKeys.notificationPrefs(orgId ?? '', profileId ?? ''),
    queryFn: () => fetchNotificationPreferences(orgId!, profileId!),
    enabled: !!orgId && !!profileId,
  });
}
