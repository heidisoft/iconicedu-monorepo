import { useQuery } from '@tanstack/react-query';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { listSessionCompletions } from '@/lib/api/session-completions';
import { queryKeys } from '@/lib/api/query-keys';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';

export function summarizeSessionCompletions(sessions: SessionCompletionVM[]) {
  return {
    completed: sessions.filter(
      (session) => session.status === 'confirmed' || session.status === 'auto_confirmed',
    ).length,
    pending: sessions.filter((session) => session.status === 'pending').length,
  };
}

export function useCompletedSessions(enabled = true): {
  sessions: SessionCompletionVM[];
  summary: { completed: number; pending: number };
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const orgId = typeof account?.org_id === 'string' ? account.org_id : '';
  const profileId = typeof profile?.id === 'string' ? profile.id : '';

  const query = useQuery({
    queryKey: queryKeys.sessionCompletions(orgId, profileId),
    queryFn: () => listSessionCompletions({ orgId, profileId, limit: 50 }),
    enabled: Boolean(enabled && orgId && profileId),
    staleTime: 60_000,
    retry: 1,
  });

  const allSessions = query.data?.items ?? [];

  return {
    sessions: allSessions.filter(
      (completion) =>
        completion.status === 'pending' ||
        ((completion.status === 'confirmed' || completion.status === 'auto_confirmed') &&
          completion.rating == null),
    ),
    summary: summarizeSessionCompletions(allSessions),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
