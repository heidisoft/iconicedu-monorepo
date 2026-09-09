import { useQuery } from '@tanstack/react-query';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import {
  getOrgSessionCompletionSummary,
  listSessionCompletions,
} from '@/lib/api/session-completions';
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

// An org admin is a role grant (owner/admin/staff) or a staff/system profile
// kind — either one sees org-wide "Sessions completed" totals, matching web.
function resolveIsOrgAdminView(profileKind: unknown, primaryRole: unknown): boolean {
  const kind = typeof profileKind === 'string' ? profileKind : null;
  const role = typeof primaryRole === 'string' ? primaryRole : null;
  return (
    kind === 'staff' ||
    kind === 'system' ||
    role === 'owner' ||
    role === 'admin' ||
    role === 'staff'
  );
}

function currentMonthRange(now = new Date()): {
  monthKey: string;
  start: string;
  end: string;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function useCompletedSessions(enabled = true): {
  sessions: SessionCompletionVM[];
  summary: { completed: number; pending: number };
  isOrgAdminView: boolean;
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const orgId = typeof account?.org_id === 'string' ? account.org_id : '';
  const profileId = typeof profile?.id === 'string' ? profile.id : '';
  const isOrgAdminView = resolveIsOrgAdminView(
    profile?.kind,
    (account as { primary_role?: unknown } | null)?.primary_role,
  );
  const month = currentMonthRange();

  // Staff/admins read an org-wide summary (every classroom session, "this
  // month" completed) regardless of the carousel rollout flag — it's an org
  // KPI, not the per-student confirmation feature.
  const orgSummaryQuery = useQuery({
    queryKey: queryKeys.orgSessionCompletionSummary(orgId, month.monthKey),
    queryFn: () =>
      getOrgSessionCompletionSummary({
        orgId,
        completedSince: month.start,
        completedUntil: month.end,
      }),
    enabled: Boolean(orgId && isOrgAdminView),
    staleTime: 60_000,
    retry: 1,
  });

  const query = useQuery({
    queryKey: queryKeys.sessionCompletions(orgId, profileId),
    queryFn: () => listSessionCompletions({ orgId, profileId, limit: 50 }),
    enabled: Boolean(enabled && orgId && profileId && !isOrgAdminView),
    staleTime: 60_000,
    retry: 1,
  });

  const allSessions = query.data?.items ?? [];

  if (isOrgAdminView) {
    return {
      sessions: [],
      summary: orgSummaryQuery.data ?? { completed: 0, pending: 0 },
      isOrgAdminView,
      isPending: orgSummaryQuery.isPending,
      isError: orgSummaryQuery.isError,
      refetch: orgSummaryQuery.refetch,
    };
  }

  return {
    sessions: allSessions.filter(
      (completion) =>
        completion.status === 'pending' ||
        ((completion.status === 'confirmed' || completion.status === 'auto_confirmed') &&
          completion.rating == null &&
          // `ratedAt` set with no `rating` = the viewer confirmed but chose not
          // to vote (skip-rating) — resolved, so keep it out of the carousel.
          completion.ratedAt == null),
    ),
    summary: summarizeSessionCompletions(allSessions),
    isOrgAdminView,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
