import { useQuery } from '@tanstack/react-query';
import { fetchSpaceSchedulesByChannelId, queryKeys } from '@/lib/api/queries';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

/**
 * Fetches sessions for the learning space that owns the given channel.
 * Intentionally decoupled from channel/message logic.
 */
export function useSpaceSessions(
  channelId: string,
  orgId: string,
): {
  schedules: ClassScheduleVM[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.spaceSchedules(channelId, orgId),
    queryFn: () => fetchSpaceSchedulesByChannelId(channelId, orgId),
    enabled: Boolean(channelId && orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    schedules: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load sessions') : null,
  };
}
