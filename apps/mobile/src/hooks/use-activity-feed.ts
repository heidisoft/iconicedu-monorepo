import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchActivityFeed, markActivityFeedRead, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';
import type { ActivityFeedVM } from '@iconicedu/shared-types';

export function useActivityFeed() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  return useQuery({
    queryKey: queryKeys.inbox(orgId ?? '', profileId ?? ''),
    queryFn: () => fetchActivityFeed(orgId!, profileId!),
    enabled: !!orgId && !!profileId,
  });
}

export function useMarkActivityFeedRead() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  return useMutation({
    mutationFn: (ids: string[]) => markActivityFeedRead(orgId!, profileId!, ids),
    onMutate: async (ids) => {
      const queryKey = queryKeys.inbox(orgId ?? '', profileId ?? '');
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ActivityFeedVM>(queryKey);

      queryClient.setQueryData<ActivityFeedVM>(queryKey, (old) => {
        if (!old) return old;
        const idSet = new Set(ids);
        return {
          ...old,
          sections: old.sections.map((section) => ({
            ...section,
            items: section.items.map((item) => {
              const targeted = idSet.has(item.ids.id);
              return targeted
                ? { ...item, state: { ...item.state, isRead: true } }
                : item;
            }),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKeys.inbox(orgId ?? '', profileId ?? ''), ctx.prev);
      }
    },
  });
}
