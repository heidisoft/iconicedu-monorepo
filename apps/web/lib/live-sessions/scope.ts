import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import type { ResolvedLiveSessionScope } from '@iconicedu/web/lib/live-sessions/types';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const UPCOMING_OCCURRENCE_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_OCCURRENCE_GRACE_MS = 30 * 60 * 1000;
const EARLY_JOIN_ALLOWANCE_MS = 15 * 60 * 1000;

function buildOccurrenceLabel(schedule: ClassScheduleVM, occurrenceKey: string) {
  const date = new Date(occurrenceKey);
  return `${schedule.title} · ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function findRelevantOccurrence(schedule: ClassScheduleVM, now: Date) {
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + UPCOMING_OCCURRENCE_LOOKAHEAD_MS);
  const expanded = expandRecurringEvents([schedule], rangeStart, rangeEnd);
  const nowTime = now.getTime();

  const scheduledWindowOccurrence = expanded
    .filter((event) => {
      const startAt = new Date(event.startAt).getTime();
      const endAt = new Date(event.endAt).getTime();
      return (
        startAt - EARLY_JOIN_ALLOWANCE_MS <= nowTime &&
        endAt + RECENT_OCCURRENCE_GRACE_MS > nowTime
      );
    })
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

  if (scheduledWindowOccurrence) {
    return {
      occurrence: scheduledWindowOccurrence,
      isScheduledSessionWindow: true,
    };
  }

  return {
    occurrence: null,
    isScheduledSessionWindow: false,
  };
}

export async function resolveChannelLiveSessionScope(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  now?: Date;
}): Promise<ResolvedLiveSessionScope> {
  const now = input.now ?? new Date();
  const schedules = await buildClassSchedulesByOrg(input.supabase, input.orgId);
  const channelSchedules = schedules.filter(
    (schedule) =>
      schedule.source.kind === 'class_session' &&
      schedule.source.channelId === input.channelId,
  );

  for (const schedule of channelSchedules) {
    const relevantOccurrence = findRelevantOccurrence(schedule, now);
    if (!relevantOccurrence.occurrence) {
      continue;
    }

    return {
      scopeKey: `occurrence:${relevantOccurrence.occurrence.startAt}`,
      occurrenceKey: relevantOccurrence.occurrence.startAt,
      occurrenceEndAt: relevantOccurrence.occurrence.endAt,
      occurrenceLabel: buildOccurrenceLabel(
        schedule,
        relevantOccurrence.occurrence.startAt,
      ),
      schedule,
      isScheduledSessionWindow: relevantOccurrence.isScheduledSessionWindow,
    };
  }

  return {
    scopeKey: `channel:${input.channelId}`,
    occurrenceKey: null,
    occurrenceEndAt: null,
    occurrenceLabel: null,
    schedule: null,
    isScheduledSessionWindow: false,
  };
}
