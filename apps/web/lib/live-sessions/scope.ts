import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import type { ResolvedLiveSessionScope } from '@iconicedu/web/lib/live-sessions/types';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const UPCOMING_OCCURRENCE_LEAD_MS = 60 * 60 * 1000;

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
  const rangeEnd = new Date(now.getTime() + UPCOMING_OCCURRENCE_LEAD_MS);
  const expanded = expandRecurringEvents([schedule], rangeStart, rangeEnd);

  const liveOccurrence = expanded.find((event) => {
    const startAt = new Date(event.startAt).getTime();
    const endAt = new Date(event.endAt).getTime();
    const nowTime = now.getTime();
    return startAt <= nowTime && nowTime <= endAt;
  });

  if (liveOccurrence) {
    return liveOccurrence;
  }

  return expanded
    .filter((event) => {
      const startAt = new Date(event.startAt).getTime();
      const diff = startAt - now.getTime();
      return diff >= 0 && diff <= UPCOMING_OCCURRENCE_LEAD_MS;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
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
      schedule.source.kind === 'class_session' && schedule.source.channelId === input.channelId,
  );

  for (const schedule of channelSchedules) {
    const relevantOccurrence = findRelevantOccurrence(schedule, now);
    if (!relevantOccurrence) {
      continue;
    }

    return {
      scopeKey: `occurrence:${relevantOccurrence.startAt}`,
      occurrenceKey: relevantOccurrence.startAt,
      occurrenceEndAt: relevantOccurrence.endAt,
      occurrenceLabel: buildOccurrenceLabel(schedule, relevantOccurrence.startAt),
      schedule,
    };
  }

  return {
    scopeKey: `channel:${input.channelId}`,
    occurrenceKey: null,
    occurrenceEndAt: null,
    occurrenceLabel: null,
    schedule: null,
  };
}
