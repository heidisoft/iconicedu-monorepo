import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchLearningSpaces } from '@/lib/api/queries';

export function useLearningSpaces(orgId: string) {
  return useQuery<Record<string, unknown>[]>({
    queryKey: queryKeys.learningSpaces(orgId),
    queryFn: () => fetchLearningSpaces(orgId),
    enabled: !!orgId,
  });
}
