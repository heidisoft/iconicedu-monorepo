import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchDirectMessages } from '@/lib/api/queries';

export function useDirectMessages(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
) {
  return useQuery({
    queryKey: queryKeys.directMessages(orgId, myProfileId),
    queryFn: () => fetchDirectMessages(orgId, myProfileId, myAccountId),
    enabled: !!orgId && !!myProfileId && !!myAccountId,
  });
}
