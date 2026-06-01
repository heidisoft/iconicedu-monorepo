import { useQuery } from '@tanstack/react-query';
import { fetchOrgSessions, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useFamilyLinks } from './use-family-links';
import { useProfile } from './use-profile';
import { buildHomeUpcomingSessions } from '@/lib/home-metrics';
import type { ClassSession } from '@/components/sessions/session-card';
import type { ParticipantRoleVM } from '@iconicedu/shared-types';

function getScopedProfileIds(input: {
  profileKind?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
}): Set<string> {
  if (input.profileKind === 'guardian') {
    return new Set(input.childProfileIds ?? []);
  }

  if (input.profileKind === 'child' || input.profileKind === 'educator') {
    return new Set(input.profileId ? [input.profileId] : []);
  }

  return new Set<string>();
}

function isScopedSchedule(input: {
  schedule: {
    source: { kind: string };
    participants: Array<{
      ids: { id: string };
      role: ParticipantRoleVM;
    }>;
  };
  profileKind?: string | null;
  scopedProfileIds: Set<string>;
}): boolean {
  if (input.profileKind === 'staff' || input.profileKind === 'system') {
    return input.schedule.source.kind === 'class_session';
  }

  if (!input.scopedProfileIds.size || input.schedule.source.kind !== 'class_session') {
    return false;
  }

  const targetRole: ParticipantRoleVM =
    input.profileKind === 'educator' ? 'educator' : 'child';

  return input.schedule.participants.some(
    (participant) =>
      participant.role === targetRole && input.scopedProfileIds.has(participant.ids.id),
  );
}

export function useUpcomingSessions(): {
  sessions: ClassSession[];
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { childProfiles } = useFamilyLinks();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;
  const profileKind = (profile as Record<string, unknown> | undefined)?.kind as
    | string
    | undefined;
  const query = useQuery({
    queryKey: queryKeys.orgSessions(orgId ?? ''),
    queryFn: () => fetchOrgSessions(orgId!),
    enabled: !!orgId && !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  const sessions: ClassSession[] = (() => {
    const raw = query.data ?? [];
    if (!raw.length) return [];

    return buildHomeUpcomingSessions({
      schedules: raw,
      profileKind,
      profileId,
      childProfileIds: (childProfiles as Record<string, unknown>[]).map(
        (child) => child.id as string,
      ),
      now: new Date(),
      timezone:
        ((profile as Record<string, unknown> | undefined)?.timezone as
          | string
          | null
          | undefined) ?? null,
    });
  })();

  return {
    sessions,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export const __test__ = {
  getScopedProfileIds,
  isScopedSchedule,
};
