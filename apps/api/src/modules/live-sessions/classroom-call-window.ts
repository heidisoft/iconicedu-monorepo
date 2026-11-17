import type { ResolvedLiveSessionScope } from '@iconicedu/live-sessions-core';
/** Calling is stricter than joining: no early/late grace, ad-hoc or stale occurrences. */
export function classroomCallWindow(
  session: {
    occurrence_key?: string | null;
    app_metadata?: Record<string, unknown> | null;
  },
  scope: ResolvedLiveSessionScope,
  now = Date.now(),
): { startsAt: string; endsAt: string } | null {
  if (
    !session.occurrence_key ||
    !scope.schedule ||
    !scope.occurrenceKey ||
    !scope.occurrenceEndAt
  )
    return null;
  const start = Date.parse(scope.occurrenceKey);
  const end = Date.parse(scope.occurrenceEndAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    start !== Date.parse(session.occurrence_key) ||
    now < start ||
    now >= end
  )
    return null;
  if (
    session.app_metadata?.scheduleId &&
    session.app_metadata.scheduleId !== scope.schedule.ids.id
  )
    return null;
  return { startsAt: scope.occurrenceKey, endsAt: scope.occurrenceEndAt };
}
