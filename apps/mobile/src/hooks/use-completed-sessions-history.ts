import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getOrgSessionCompletionSummary,
  getSessionCompletionSummary,
  listAdminSessionCompletions,
  listSessionCompletionHistory,
} from '@/lib/api/session-completions';
import { queryKeys } from '@/lib/api/query-keys';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { resolveIsOrgAdminView } from '@/hooks/use-completed-sessions';
import {
  adminRowsForTab,
  fromProfileCompletion,
  type CompletedSessionRow,
  type CompletedSessionsTab,
  type MonthRange,
} from '@/lib/sessions/completed-sessions';

const PAGE_SIZE = 20;

export function useCompletedSessionsHistory(
  tab: CompletedSessionsTab,
  month: MonthRange,
): {
  rows: CompletedSessionRow[];
  counts: { completed: number; pending: number } | null;
  isOrgAdminView: boolean;
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
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

  const historyQuery = useInfiniteQuery({
    queryKey: queryKeys.sessionCompletionHistory(orgId, profileId, tab, month.monthKey),
    queryFn: ({ pageParam }) =>
      listSessionCompletionHistory({
        orgId,
        profileId,
        status: tab,
        completedSince: month.start,
        completedUntil: month.end,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(orgId && profileId && !isOrgAdminView),
    staleTime: 60_000,
    retry: 1,
  });

  // The admin endpoint returns every occurrence in the window in one response,
  // so both tabs share one query and are split client-side.
  const adminQuery = useQuery({
    queryKey: queryKeys.adminSessionCompletions(orgId, month.monthKey),
    queryFn: () =>
      listAdminSessionCompletions({
        orgId,
        completedSince: month.start,
        completedUntil: month.end,
      }),
    enabled: Boolean(orgId && isOrgAdminView),
    staleTime: 60_000,
    retry: 1,
  });

  // Same month-scoped counts the home tile shows, for the tab labels.
  const summaryQuery = useQuery({
    queryKey: isOrgAdminView
      ? queryKeys.orgSessionCompletionSummary(orgId, month.monthKey)
      : queryKeys.sessionCompletionSummary(orgId, profileId, month.monthKey),
    queryFn: () =>
      isOrgAdminView
        ? getOrgSessionCompletionSummary({
            orgId,
            completedSince: month.start,
            completedUntil: month.end,
          })
        : getSessionCompletionSummary({
            orgId,
            profileId,
            completedSince: month.start,
            completedUntil: month.end,
          }),
    enabled: Boolean(orgId && (isOrgAdminView || profileId)),
    staleTime: 60_000,
    retry: 1,
  });

  const rows = useMemo(() => {
    if (isOrgAdminView) return adminRowsForTab(adminQuery.data ?? [], tab);
    return (historyQuery.data?.pages ?? []).flatMap((page) =>
      page.items.map(fromProfileCompletion),
    );
  }, [adminQuery.data, historyQuery.data, isOrgAdminView, tab]);

  const listQuery = isOrgAdminView ? adminQuery : historyQuery;

  return {
    rows,
    counts: summaryQuery.data ?? null,
    isOrgAdminView,
    isPending: listQuery.isPending,
    isError: listQuery.isError,
    hasNextPage: !isOrgAdminView && Boolean(historyQuery.hasNextPage),
    isFetchingNextPage: historyQuery.isFetchingNextPage,
    fetchNextPage: () => {
      if (
        !isOrgAdminView &&
        historyQuery.hasNextPage &&
        !historyQuery.isFetchingNextPage
      ) {
        void historyQuery.fetchNextPage();
      }
    },
    refetch: () => Promise.all([listQuery.refetch(), summaryQuery.refetch()]),
  };
}
