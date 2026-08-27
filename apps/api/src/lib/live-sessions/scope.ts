import {
  expandRecurringEvents,
  getClassScheduleOccurrenceIdentity,
} from '@iconicedu/utils';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import type { ResolvedLiveSessionScope } from '@iconicedu/api/lib/live-sessions/types';
import {
  buildClassSchedulesByIds,
  buildClassSchedulesByOrg,
} from '@iconicedu/api/lib/schedules/class-schedule.builder';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const UPCOMING_OCCURRENCE_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_OCCURRENCE_GRACE_MS = 30 * 60 * 1000;
const EARLY_JOIN_ALLOWANCE_MS = 15 * 60 * 1000;

/**
 * How far either side of a requested occurrence key the recurrence is expanded
 * when resolving one exact occurrence. A day of slack absorbs timezone and DST
 * shifts between the stored key and the schedule's local calendar day.
 */
const OCCURRENCE_LOOKUP_PADDING_MS = 24 * 60 * 60 * 1000;

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

    const identity = getClassScheduleOccurrenceIdentity(relevantOccurrence.occurrence);

    return {
      scopeKey: buildOccurrenceScopeKey(identity.occurrenceKey),
      occurrenceKey: identity.occurrenceKey,
      occurrenceEndAt: relevantOccurrence.occurrence.endAt,
      occurrenceLabel: buildOccurrenceLabel(schedule, identity.occurrenceKey),
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

export function buildOccurrenceScopeKey(occurrenceKey: string) {
  return `occurrence:${occurrenceKey}`;
}

export type ResolvedClassSessionOccurrence = {
  scope: ResolvedLiveSessionScope;
  schedule: ClassScheduleVM;
  channelId: string;
  learningSpaceId: string | null;
  /** Original occurrence start — the identity clients address. */
  occurrenceKey: string;
  /** Start/end after recurrence overrides are applied. */
  effectiveStartAt: string;
  effectiveEndAt: string;
  /** Cancelled series, cancelled occurrence, or a disabled recurrence exception. */
  isCancelled: boolean;
  /**
   * Scope keys an already-live room for this occurrence may have been created
   * under. A rescheduled occurrence created before this change was keyed by its
   * *effective* start, so both are checked to keep repeat joins idempotent.
   */
  compatibleScopeKeys: string[];
};

/**
 * Resolve one exact class-session occurrence from its stable identity (issue #195).
 *
 * The caller supplies `scheduleId` + `occurrenceKey`; this re-expands the base
 * schedule's recurrence server-side and matches on the same identity, so a guessed
 * or tampered pair resolves to `null` rather than falling back to a channel-scoped
 * huddle. `now` is not consulted — a future occurrence resolves exactly like a
 * current one, which is what lets an early click still create the room under the
 * selected occurrence's scope.
 */
export async function resolveClassSessionOccurrenceScope(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  scheduleId: string;
  occurrenceKey: string;
}): Promise<ResolvedClassSessionOccurrence | null> {
  const occurrenceStartMs = new Date(input.occurrenceKey).getTime();
  if (!Number.isFinite(occurrenceStartMs)) {
    return null;
  }

  const schedules = await buildClassSchedulesByIds(input.supabase, input.orgId, [
    input.scheduleId,
  ]);
  const schedule = schedules.find((item) => item.ids.id === input.scheduleId);
  if (!schedule || schedule.source.kind !== 'class_session') {
    return null;
  }

  const channelId = schedule.source.channelId ?? null;
  if (!channelId) {
    return null;
  }

  const rangeStart = new Date(occurrenceStartMs - OCCURRENCE_LOOKUP_PADDING_MS);
  const rangeEnd = new Date(occurrenceStartMs + OCCURRENCE_LOOKUP_PADDING_MS);
  const occurrence = expandRecurringEvents([schedule], rangeStart, rangeEnd).find(
    (candidate) => {
      const identity = getClassScheduleOccurrenceIdentity(candidate);
      return (
        identity.scheduleId === input.scheduleId &&
        identity.occurrenceKey === input.occurrenceKey
      );
    },
  );

  if (!occurrence) {
    return null;
  }

  const scopeKey = buildOccurrenceScopeKey(input.occurrenceKey);
  const effectiveScopeKey = buildOccurrenceScopeKey(occurrence.startAt);

  return {
    scope: {
      scopeKey,
      occurrenceKey: input.occurrenceKey,
      occurrenceEndAt: occurrence.endAt,
      occurrenceLabel: buildOccurrenceLabel(schedule, input.occurrenceKey),
      schedule,
      // A join targeting an exact occurrence is always attributed to that
      // occurrence, whether or not it lands inside the legacy 15-minute window.
      isScheduledSessionWindow: true,
    },
    schedule,
    channelId,
    learningSpaceId: schedule.source.learningSpaceId || null,
    occurrenceKey: input.occurrenceKey,
    effectiveStartAt: occurrence.startAt,
    effectiveEndAt: occurrence.endAt,
    isCancelled:
      occurrence.status === 'cancelled' || occurrence.uiState?.disabled === true,
    compatibleScopeKeys:
      effectiveScopeKey === scopeKey ? [scopeKey] : [scopeKey, effectiveScopeKey],
  };
}
