import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchChannels } from '@/lib/api/queries';

export function useChannels(orgId: string) {
  return useQuery({
    queryKey: queryKeys.channels(orgId),
    queryFn: () => fetchChannels(orgId),
    enabled: !!orgId,
  });
}
