import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchDirectMessages } from '@/lib/api/queries';

export function useDirectMessages(orgId: string, profileId: string) {
  return useQuery({
    queryKey: queryKeys.directMessages(orgId, profileId),
    queryFn: () => fetchDirectMessages(orgId, profileId),
    enabled: !!orgId && !!profileId,
  });
}
