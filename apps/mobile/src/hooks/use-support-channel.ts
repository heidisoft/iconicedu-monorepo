import { useQuery } from '@tanstack/react-query';
import { fetchSupportChannel, queryKeys } from '@/lib/api/queries';

export function useSupportChannel(orgId: string) {
  return useQuery({
    queryKey: queryKeys.supportChannel(orgId),
    queryFn: () => fetchSupportChannel(orgId),
    enabled: !!orgId,
  });
}
