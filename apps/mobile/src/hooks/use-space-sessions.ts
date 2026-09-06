import { useQuery } from '@tanstack/react-query';
import {
  fetchChannelSessionCompletions,
  fetchSpaceSchedulesByChannelId,
  queryKeys,
} from '@/lib/api/queries';
import type {
  ChannelSessionCompletionVM,
  ClassScheduleVM,
} from '@iconicedu/shared-types';

const EMPTY_COMPLETIONS: ChannelSessionCompletionVM[] = [];

/**
 * Fetches sessions for the class that owns the given channel, plus the
 * cross-party completion state: `sessionCompletions` (any of teacher / parent /
 * staff confirmed) and `disputedSessions` (a party disputed). The Sessions tab
 * counts a past session as complete unless it is disputed. Intentionally
 * decoupled from channel/message logic. Completion-state failures are swallowed
 * — it is decorative and must not block the sessions list.
 */
export function useSpaceSessions(
  channelId: string,
  orgId: string,
): {
  schedules: ClassScheduleVM[];
  sessionCompletions: ChannelSessionCompletionVM[];
  disputedSessions: ChannelSessionCompletionVM[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.spaceSchedules(channelId, orgId),
    queryFn: () => fetchSpaceSchedulesByChannelId(channelId, orgId),
    enabled: Boolean(channelId && orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: completionState } = useQuery({
    queryKey: queryKeys.spaceSessionCompletions(channelId, orgId),
    queryFn: () => fetchChannelSessionCompletions(channelId, orgId),
    enabled: Boolean(channelId && orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    schedules: data ?? [],
    sessionCompletions: completionState?.completions ?? EMPTY_COMPLETIONS,
    disputedSessions: completionState?.disputed ?? EMPTY_COMPLETIONS,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Failed to load sessions'
      : null,
  };
}
