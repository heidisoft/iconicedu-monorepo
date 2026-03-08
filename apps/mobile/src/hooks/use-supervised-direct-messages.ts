import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchSupervisedDirectMessages } from '@/lib/api/queries';

export function useSupervisedDirectMessages(
  orgId: string,
  guardianAccountId: string,
  guardianProfileId: string,
) {
  return useQuery({
    queryKey: queryKeys.supervisedDirectMessages(orgId, guardianAccountId),
    queryFn: () =>
      fetchSupervisedDirectMessages(orgId, guardianAccountId, guardianProfileId),
    enabled: !!orgId && !!guardianAccountId && !!guardianProfileId,
  });
}
