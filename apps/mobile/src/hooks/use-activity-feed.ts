import { useQuery } from '@tanstack/react-query';
import { fetchActivityFeed, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

export function useActivityFeed() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  return useQuery({
    queryKey: queryKeys.inbox(orgId ?? '', profileId ?? ''),
    queryFn: () => fetchActivityFeed(orgId!, profileId!),
    enabled: !!orgId && !!profileId,
  });
}
