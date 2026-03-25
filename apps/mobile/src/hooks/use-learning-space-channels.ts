import { useQuery } from '@tanstack/react-query';
import { fetchLearningSpaceChannels } from '@/lib/api/queries';

export function useLearningSpaceChannels(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
  myProfileKind?: string | null,
) {
  return useQuery({
    queryKey: [
      'learningSpaceChannels',
      orgId,
      myProfileId,
      myProfileKind ?? null,
    ] as const,
    queryFn: () =>
      fetchLearningSpaceChannels(orgId, myProfileId, myAccountId, myProfileKind ?? null),
    enabled: !!orgId && !!myProfileId && !!myAccountId,
  });
}
