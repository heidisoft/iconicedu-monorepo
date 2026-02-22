import { useQuery } from '@tanstack/react-query';
import { fetchLearningSpaceChannels } from '@/lib/api/queries';

export function useLearningSpaceChannels(orgId: string, myProfileId: string) {
  return useQuery({
    queryKey: ['learningSpaceChannels', orgId, myProfileId] as const,
    queryFn: () => fetchLearningSpaceChannels(orgId, myProfileId),
    enabled: !!orgId && !!myProfileId,
  });
}
