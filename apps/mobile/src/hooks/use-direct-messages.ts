import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchDirectMessages } from '@/lib/api/queries';

export function useDirectMessages(orgId: string, myProfileId: string) {
  return useQuery({
    queryKey: queryKeys.directMessages(orgId, myProfileId),
    queryFn: () => fetchDirectMessages(orgId, myProfileId),
    enabled: !!orgId && !!myProfileId,
  });
}
