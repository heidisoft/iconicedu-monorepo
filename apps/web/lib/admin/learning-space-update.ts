import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import {
  insertClassSchedules,
  publishParticipantInviteActivities,
} from '@iconicedu/web/lib/admin/learning-space-create';
import {
  type CanonicalLearningSpaceSchedule,
  buildCanonicalLearningSpaceSchedulesFromExisting,
  buildCanonicalLearningSpaceSchedulesFromPayload,
  getDateFromISOInTimezone,
  getTimeFromISOInTimezone,
  buildLearningSpaceScheduleHashBundleFromCanonical,
  buildLearningSpaceSchedulesHashKeyFromExisting,
  buildLearningSpaceSchedulesHashKeyFromPayload,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import { compileLearningSpaceReminderJobs } from '@iconicedu/web/lib/automation/reminder-jobs';
import { ensureSystemProfileId } from '@iconicedu/web/lib/automation/system-profile';
import type {
  ChannelUiDefaultsVM,
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceResourcePayload,
  LearningSpaceSchedulePayload,
} from '@iconicedu/shared-types';

type ParticipantProfileSnapshotRow = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  ui_theme_key?: string | null;
};

type LearningSpaceLinkSnapshotRow = {
  label: string;
  icon_key?: string | null;
  url?: string | null;
  status?: string | null;
  hidden?: boolean | null;
};

type ExistingScheduleSnapshot = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone?: string | null;
};

type ExistingRecurrenceSnapshot = {
  id: string;
  schedule_id: string;
  frequency?: string | null;
  interval?: number | null;
  count?: number | null;
  until?: string | null;
  timezone?: string | null;
  bysecond?: number[] | null;
  byminute?: number[] | null;
  byhour?: number[] | null;
  byday?: string[] | null;
  bymonthday?: number[] | null;
  byyearday?: number[] | null;
  byweekno?: number[] | null;
  bymonth?: number[] | null;
  bysetpos?: number[] | null;
  wkst?: string | null;
};

type ExistingExceptionSnapshot = {
  recurrence_id: string;
  occurrence_key: string;
  reason?: string | null;
};

type ExistingOverrideSnapshot = {
  recurrence_id: string;
  occurrence_key: string;
  patch?: Record<string, unknown> | null;
};

type ExistingScheduleCompareInput = {
  id: string;
  title?: string | null;
  startAt: string;
  endAt: string;
  timezone?: string | null;
  recurrence?: ExistingRecurrenceSnapshot | null;
  exceptions?: Array<{ occurrenceKey: string; reason?: string | null }>;
  overrides?: Array<{
    occurrenceKey: string;
    startAt?: string | null;
    endAt?: string | null;
    reason?: string | null;
  }>;
};

type NormalizedIncomingSchedule = {
  startAt: string;
  endAt: string;
  timezone: string | null;
  baseHash: string;
  fullHash: string;
  canonical: CanonicalLearningSpaceSchedule;
};

type NormalizedExistingSchedule = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  baseHash: string;
  fullHash: string;
  canonical: CanonicalLearningSpaceSchedule;
};

export type LearningSpaceScheduleDiffPlan = {
  added: NormalizedIncomingSchedule[];
  removed: NormalizedExistingSchedule[];
  rescheduled: Array<{
    previous: NormalizedExistingSchedule;
    next: NormalizedIncomingSchedule;
  }>;
};

type RemovedParticipantSnapshot = {
  profileId: string;
  snapshot?: {
    name: string;
    avatarUrl?: string | null;
    themeKey?: string | null;
  };
};

type RemovedMembersActivity = {
  eventType: 'member.removed' | 'members.removed';
  dedupeKey: string;
  payload: {
    learningSpaceId: string;
    channelId: string;
    title: string;
    memberProfileId: string | null;
    memberDisplayName: string | null;
    memberAvatarUrl: string | null;
    memberThemeKey: string | null;
    memberCount: number;
    members: Array<{
      profileId: string;
      displayName: string | null;
      avatarUrl: string | null;
      themeKey: string | null;
    }>;
    invitedCount: number;
    invitedMembers: Array<{
      profileId: string;
      name: string;
      avatarUrl?: string | null;
      themeKey?: string | null;
    }>;
    activityPhase: 'updated';
  };
};

type ScheduleChangeActivity = {
  eventType:
    | 'class.session.scheduled'
    | 'class.session.canceled'
    | 'class.session.rescheduled';
  dedupeKey: string;
  payload: {
    learningSpaceId: string;
    channelId: string;
    scheduleId: string;
    title: string;
    activityPhase: 'updated';
    invitedCount: number;
    invitedMembers: Array<{
      profileId: string;
      name: string;
      avatarUrl?: string | null;
      themeKey?: string | null;
    }>;
    firstSessionStartAt?: string | null;
    firstSessionTimezone?: string | null;
    startAt?: string | null;
    timezone?: string | null;
    canceledStartAt?: string | null;
    canceledReason?: string | null;
    rescheduledFromStartAt?: string | null;
    rescheduledToStartAt?: string | null;
    rescheduledReason?: string | null;
  };
};

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function shouldPublishScheduleChangeActivity(
  activity: ScheduleChangeActivity,
  nowIso: string,
) {
  const nowTime = toTimestamp(nowIso);
  if (nowTime === null) {
    return true;
  }

  const payload = activity.payload;
  const referenceAt =
    activity.eventType === 'class.session.canceled'
      ? (payload.canceledStartAt ??
        payload.startAt ??
        payload.firstSessionStartAt ??
        null)
      : activity.eventType === 'class.session.rescheduled'
        ? (payload.rescheduledToStartAt ??
          payload.rescheduledFromStartAt ??
          payload.startAt ??
          payload.firstSessionStartAt ??
          null)
        : (payload.startAt ?? payload.firstSessionStartAt ?? null);

  const referenceTime = toTimestamp(referenceAt);
  if (referenceTime === null) {
    return true;
  }

  return referenceTime >= nowTime;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(normalizeForCompare(value));
}

function normalizeForCompare(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCompare(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const normalizedValue = normalizeForCompare(record[key]);
      if (normalizedValue !== undefined) {
        normalized[key] = normalizedValue;
      }
    }
    return normalized;
  }

  return value;
}

function normalizeLinksForCompare(links: Array<LearningSpaceLinkSnapshotRow>) {
  return [...links]
    .map((link) => ({
      label: link.label?.trim() ?? '',
      iconKey: link.icon_key ?? null,
      url: link.url ?? null,
      status: link.status ?? 'active',
      hidden: link.hidden ?? null,
    }))
    .filter((link) => link.label.length > 0)
    .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
}

function normalizeIncomingLinksForCompare(
  links: LearningSpaceResourcePayload[] | null | undefined,
) {
  return [...(links ?? [])]
    .map((link) => ({
      label: link.label?.trim() ?? '',
      iconKey: link.iconKey ?? null,
      url: link.url ?? null,
      status: link.status ?? 'active',
      hidden: link.hidden ?? null,
    }))
    .filter((link) => link.label.length > 0)
    .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
}

function normalizeParticipantIds(ids: string[]) {
  return [...ids].sort();
}

function joinNaturalList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? '';
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

const SCHEDULE_DIFF_DEBUG_ENABLED =
  process.env.DEBUG_LEARNING_SPACE_SCHEDULE_DIFF === '1';

function debugScheduleDiff(stage: string, details: Record<string, unknown>) {
  if (!SCHEDULE_DIFF_DEBUG_ENABLED) {
    return;
  }
  console.log('[learning-space:update:schedule-diff]', stage, details);
}

export function buildRemovedMembersActivity(input: {
  learningSpaceId: string;
  channelId: string;
  title: string;
  occurredAt: string;
  removedParticipants: RemovedParticipantSnapshot[];
  invitedMembers: Array<{
    profileId: string;
    name: string;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }>;
}): RemovedMembersActivity | null {
  if (!input.removedParticipants.length) {
    return null;
  }

  const members = input.removedParticipants.map((participant) => ({
    profileId: participant.profileId,
    displayName: participant.snapshot?.name ?? null,
    avatarUrl: participant.snapshot?.avatarUrl ?? null,
    themeKey: participant.snapshot?.themeKey ?? null,
  }));
  const firstMember = members[0];
  const isPlural = members.length > 1;

  return {
    eventType: isPlural ? 'members.removed' : 'member.removed',
    dedupeKey: isPlural
      ? `members.removed:${input.learningSpaceId}:${input.occurredAt}`
      : `member.removed:${input.learningSpaceId}:${firstMember?.profileId ?? 'unknown'}:${input.occurredAt}`,
    payload: {
      learningSpaceId: input.learningSpaceId,
      channelId: input.channelId,
      title: input.title,
      memberProfileId: firstMember?.profileId ?? null,
      memberDisplayName: firstMember?.displayName ?? null,
      memberAvatarUrl: firstMember?.avatarUrl ?? null,
      memberThemeKey: firstMember?.themeKey ?? null,
      memberCount: members.length,
      members,
      invitedCount: input.invitedMembers.length,
      invitedMembers: input.invitedMembers,
      activityPhase: 'updated',
    },
  };
}

export function buildExceptionAndOverrideScheduleChangeActivities(input: {
  learningSpaceId: string;
  channelId: string;
  title: string;
  occurredAt: string;
  invitedMembers: Array<{
    profileId: string;
    name: string;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }>;
  pairs: Array<{
    scheduleId: string;
    timezone: string | null;
    previousFullHash?: string;
    nextFullHash?: string;
    previous: {
      exceptions: Array<{ occurrenceKey: string; reason: string | null }>;
      overrides: Array<{
        occurrenceKey: string;
        startAt: string | null;
        endAt: string | null;
        reason: string | null;
      }>;
    };
    next: {
      exceptions: Array<{ occurrenceKey: string; reason: string | null }>;
      overrides: Array<{
        occurrenceKey: string;
        startAt: string | null;
        endAt: string | null;
        reason: string | null;
      }>;
    };
  }>;
  nextSessionStartAt?: string | null;
}): ScheduleChangeActivity[] {
  const activities: ScheduleChangeActivity[] = [];

  input.pairs.forEach((pair, pairIndex) => {
    if (
      pair.previousFullHash &&
      pair.nextFullHash &&
      pair.previousFullHash === pair.nextFullHash
    ) {
      debugScheduleDiff('pair-diff-skip-full-hash-equal', {
        learningSpaceId: input.learningSpaceId,
        scheduleId: pair.scheduleId,
        pairIndex,
      });
      return;
    }

    const timezone = pair.timezone ?? 'UTC';
    const normalizeReason = (value: string | null | undefined) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    };
    const toOccurrenceDate = (occurrenceKey: string) =>
      getDateFromISOInTimezone(occurrenceKey, timezone) ?? occurrenceKey;

    const previousExceptions = new Map(
      pair.previous.exceptions.map((entry) => [
        toOccurrenceDate(entry.occurrenceKey),
        entry,
      ]),
    );
    const nextExceptions = new Map(
      pair.next.exceptions.map((entry) => [toOccurrenceDate(entry.occurrenceKey), entry]),
    );

    const toOverrideSemantic = (entry: {
      occurrenceKey: string;
      startAt: string | null;
      endAt: string | null;
      reason: string | null;
    }) => {
      const occurrenceDate = toOccurrenceDate(entry.occurrenceKey);
      const newDate = entry.startAt
        ? getDateFromISOInTimezone(entry.startAt, timezone)
        : null;
      const newTime = entry.startAt
        ? getTimeFromISOInTimezone(entry.startAt, timezone)
        : null;
      const durationMinutes =
        entry.startAt && entry.endAt
          ? Math.max(
              1,
              Math.round(
                (new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) /
                  60000,
              ),
            )
          : null;
      return {
        occurrenceDate,
        newDate,
        newTime,
        durationMinutes,
        reason: normalizeReason(entry.reason),
        raw: entry,
      };
    };

    const previousOverrides = new Map(
      pair.previous.overrides.map((entry) => {
        const semantic = toOverrideSemantic(entry);
        return [semantic.occurrenceDate, semantic] as const;
      }),
    );
    const nextOverrides = new Map(
      pair.next.overrides.map((entry) => {
        const semantic = toOverrideSemantic(entry);
        return [semantic.occurrenceDate, semantic] as const;
      }),
    );
    const changedKeys = new Set([
      ...previousExceptions.keys(),
      ...nextExceptions.keys(),
      ...previousOverrides.keys(),
      ...nextOverrides.keys(),
    ]);

    const pairDiffs: Array<{
      occurrenceKey: string;
      transition: string;
      eventType: ScheduleChangeActivity['eventType'];
    }> = [];

    for (const occurrenceKey of changedKeys) {
      const previousOverrideSemantic = previousOverrides.get(occurrenceKey) ?? null;
      const nextOverrideSemantic = nextOverrides.get(occurrenceKey) ?? null;
      const previousOverride = previousOverrideSemantic?.raw ?? null;
      const nextOverride = nextOverrideSemantic?.raw ?? null;
      const previousException = previousExceptions.get(occurrenceKey) ?? null;
      const nextException = nextExceptions.get(occurrenceKey) ?? null;
      const previousState = previousException
        ? 'exception'
        : previousOverride
          ? 'override'
          : 'scheduled';
      const nextState = nextException
        ? 'exception'
        : nextOverride
          ? 'override'
          : 'scheduled';

      if (
        previousState === nextState &&
        previousState === 'exception' &&
        normalizeReason(previousException?.reason) ===
          normalizeReason(nextException?.reason)
      ) {
        continue;
      }
      if (
        previousState === nextState &&
        previousState === 'override' &&
        previousOverrideSemantic?.newDate === nextOverrideSemantic?.newDate &&
        previousOverrideSemantic?.newTime === nextOverrideSemantic?.newTime &&
        previousOverrideSemantic?.durationMinutes ===
          nextOverrideSemantic?.durationMinutes &&
        previousOverrideSemantic?.reason === nextOverrideSemantic?.reason
      ) {
        continue;
      }
      if (previousState === nextState && previousState === 'scheduled') {
        continue;
      }

      if (nextState === 'scheduled') {
        const scheduledStartAt =
          previousOverride?.occurrenceKey ??
          previousException?.occurrenceKey ??
          occurrenceKey;
        pairDiffs.push({
          occurrenceKey,
          transition: `${previousState}->scheduled`,
          eventType: 'class.session.scheduled',
        });
        const activity: ScheduleChangeActivity = {
          eventType: 'class.session.scheduled',
          dedupeKey: `schedule.unscheduled-change:${input.learningSpaceId}:${pair.scheduleId}:${pairIndex}:${occurrenceKey}:${input.occurredAt}`,
          payload: {
            learningSpaceId: input.learningSpaceId,
            channelId: input.channelId,
            scheduleId: pair.scheduleId,
            title: input.title,
            activityPhase: 'updated',
            invitedCount: input.invitedMembers.length,
            invitedMembers: input.invitedMembers,
            firstSessionStartAt: input.nextSessionStartAt ?? scheduledStartAt,
            firstSessionTimezone: pair.timezone,
            startAt: scheduledStartAt,
            timezone: pair.timezone,
          },
        };
        if (shouldPublishScheduleChangeActivity(activity, input.occurredAt)) {
          activities.push(activity);
        }
        continue;
      }

      if (nextState === 'exception') {
        pairDiffs.push({
          occurrenceKey,
          transition: `${previousState}->exception`,
          eventType: 'class.session.canceled',
        });
        const activity: ScheduleChangeActivity = {
          eventType: 'class.session.canceled',
          dedupeKey: `schedule.exception:${input.learningSpaceId}:${pair.scheduleId}:${pairIndex}:${occurrenceKey}:${input.occurredAt}`,
          payload: {
            learningSpaceId: input.learningSpaceId,
            channelId: input.channelId,
            scheduleId: pair.scheduleId,
            title: input.title,
            activityPhase: 'updated',
            invitedCount: input.invitedMembers.length,
            invitedMembers: input.invitedMembers,
            firstSessionStartAt: input.nextSessionStartAt ?? occurrenceKey,
            firstSessionTimezone: pair.timezone,
            canceledStartAt: nextException?.occurrenceKey ?? occurrenceKey,
            canceledReason: nextException?.reason ?? null,
            timezone: pair.timezone,
          },
        };
        if (shouldPublishScheduleChangeActivity(activity, input.occurredAt)) {
          activities.push(activity);
        }
        continue;
      }

      const fromStartAt =
        previousState === 'override'
          ? (previousOverride?.startAt ??
            previousOverride?.occurrenceKey ??
            previousException?.occurrenceKey ??
            occurrenceKey)
          : (previousException?.occurrenceKey ??
            previousOverride?.startAt ??
            previousOverride?.occurrenceKey ??
            occurrenceKey);
      const toStartAt =
        nextOverride?.startAt ??
        nextOverride?.occurrenceKey ??
        nextException?.occurrenceKey ??
        occurrenceKey;
      pairDiffs.push({
        occurrenceKey,
        transition: `${previousState}->override`,
        eventType: 'class.session.rescheduled',
      });
      const activity: ScheduleChangeActivity = {
        eventType: 'class.session.rescheduled',
        dedupeKey: `schedule.override:${input.learningSpaceId}:${pair.scheduleId}:${pairIndex}:${occurrenceKey}:${input.occurredAt}`,
        payload: {
          learningSpaceId: input.learningSpaceId,
          channelId: input.channelId,
          scheduleId: pair.scheduleId,
          title: input.title,
          activityPhase: 'updated',
          invitedCount: input.invitedMembers.length,
          invitedMembers: input.invitedMembers,
          firstSessionStartAt: input.nextSessionStartAt ?? toStartAt,
          firstSessionTimezone: pair.timezone,
          rescheduledFromStartAt: fromStartAt,
          rescheduledToStartAt: toStartAt,
          rescheduledReason: nextOverride?.reason ?? null,
          timezone: pair.timezone,
        },
      };
      if (shouldPublishScheduleChangeActivity(activity, input.occurredAt)) {
        activities.push(activity);
      }
    }

    if (pairDiffs.length) {
      debugScheduleDiff('pair-diff', {
        learningSpaceId: input.learningSpaceId,
        scheduleId: pair.scheduleId,
        pairIndex,
        diffCount: pairDiffs.length,
        pairDiffs,
      });
    }
    debugScheduleDiff('pair-semantic-compare', {
      learningSpaceId: input.learningSpaceId,
      scheduleId: pair.scheduleId,
      pairIndex,
      timezone,
      previousExceptionDates: [...previousExceptions.keys()],
      nextExceptionDates: [...nextExceptions.keys()],
      previousOverrideDates: [...previousOverrides.keys()],
      nextOverrideDates: [...nextOverrides.keys()],
    });
  });

  return activities;
}

function resolveNextSessionStartAtFromIncomingSchedules(input: {
  schedules: NormalizedIncomingSchedule[];
  nowIso: string;
}) {
  const nowTime = new Date(input.nowIso).getTime();
  const candidates = input.schedules.flatMap((schedule) => {
    const exceptionKeys = new Set(
      schedule.canonical.exceptions.map((entry) => entry.occurrenceKey),
    );
    const base = exceptionKeys.has(schedule.startAt) ? [] : [schedule.startAt];
    const overrides = schedule.canonical.overrides
      .map((entry) => entry.startAt ?? entry.occurrenceKey)
      .filter((value): value is string => Boolean(value));
    return [...base, ...overrides];
  });
  const normalized = [...new Set(candidates)]
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);

  return (
    normalized.find((entry) => entry.time >= nowTime)?.value ??
    normalized[0]?.value ??
    null
  );
}

async function loadLearningSpaceParticipantSnapshot(input: {
  supabase: SupabaseClient;
  orgId: string;
  learningSpaceId: string;
}) {
  const participantsResponse = await input.supabase
    .from('learning_space_participants')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('learning_space_id', input.learningSpaceId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const participantIds = (participantsResponse.data ?? []).map((row) => row.profile_id);
  if (!participantIds.length) {
    return [];
  }

  return loadProfileSnapshotsByIds({
    supabase: input.supabase,
    orgId: input.orgId,
    profileIds: participantIds,
  });
}

async function loadProfileSnapshotsByIds(input: {
  supabase: SupabaseClient;
  orgId: string;
  profileIds: string[];
}) {
  const participantIds = input.profileIds.filter(Boolean);
  if (!participantIds.length) {
    return [];
  }

  const profilesResponse = await input.supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ui_theme_key')
    .eq('org_id', input.orgId)
    .in('id', participantIds)
    .is('deleted_at', null)
    .returns<ParticipantProfileSnapshotRow[]>();

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  const profileById = new Map((profilesResponse.data ?? []).map((row) => [row.id, row]));
  return participantIds.map((profileId) => {
    const profile = profileById.get(profileId);
    return {
      profileId,
      name: profile?.display_name ?? 'Participant',
      avatarUrl: profile?.avatar_url ?? null,
      themeKey: profile?.ui_theme_key ?? null,
    };
  });
}

function normalizeExistingSchedulesForCompare(
  schedules: ExistingScheduleCompareInput[],
): NormalizedExistingSchedule[] {
  return buildCanonicalLearningSpaceSchedulesFromExisting(
    schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title ?? null,
      startAt: schedule.startAt,
      endAt: schedule.endAt,
      timezone: schedule.timezone ?? null,
      recurrence: schedule.recurrence ?? null,
      exceptions: schedule.exceptions ?? [],
      overrides: schedule.overrides ?? [],
    })),
  ).map((canonical) => ({
    ...buildLearningSpaceScheduleHashBundleFromCanonical(canonical),
    id: canonical.id ?? 'unknown',
    title: canonical.title ?? 'Session',
    startAt: canonical.startAt,
    endAt: canonical.endAt,
    timezone: canonical.timezone,
    canonical,
  }));
}

function buildExistingScheduleCompareInputs(input: {
  schedules: ExistingScheduleSnapshot[];
  recurrencesByScheduleId: Map<string, ExistingRecurrenceSnapshot>;
  exceptionsByScheduleId: Map<string, Map<string, string | null>>;
  overridesByScheduleId: Map<
    string,
    Map<string, { startAt: string | null; endAt: string | null; reason: string | null }>
  >;
}): ExistingScheduleCompareInput[] {
  return input.schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    startAt: schedule.start_at,
    endAt: schedule.end_at,
    timezone: schedule.timezone ?? null,
    recurrence: input.recurrencesByScheduleId.get(schedule.id) ?? null,
    exceptions: [
      ...(input.exceptionsByScheduleId.get(schedule.id) ?? new Map()).entries(),
    ].map(([occurrenceKey, reason]) => ({
      occurrenceKey,
      reason,
    })),
    overrides: [
      ...(input.overridesByScheduleId.get(schedule.id) ?? new Map()).entries(),
    ].map(([occurrenceKey, patch]) => ({
      occurrenceKey,
      startAt: patch.startAt,
      endAt: patch.endAt,
      reason: patch.reason,
    })),
  }));
}

function normalizeIncomingSchedulesForCompare(
  schedules: LearningSpaceSchedulePayload[] | null | undefined,
): NormalizedIncomingSchedule[] {
  return buildCanonicalLearningSpaceSchedulesFromPayload(schedules).map((canonical) => ({
    ...buildLearningSpaceScheduleHashBundleFromCanonical(canonical),
    startAt: canonical.startAt,
    endAt: canonical.endAt,
    timezone: canonical.timezone,
    canonical,
  }));
}

function pairSchedulesForCompare(
  previous: NormalizedExistingSchedule[],
  next: NormalizedIncomingSchedule[],
) {
  const remainingPrevious = [...previous];
  const pairs: Array<{
    previous: NormalizedExistingSchedule;
    next: NormalizedIncomingSchedule;
  }> = [];

  const toTimestamp = (value: string) => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  for (const nextItem of next) {
    const matchingIndexes = remainingPrevious
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.baseHash === nextItem.baseHash);

    if (!matchingIndexes.length) {
      continue;
    }

    const nextTime = toTimestamp(nextItem.startAt);
    const best = matchingIndexes.reduce((currentBest, candidate) => {
      const candidateDiff = Math.abs(toTimestamp(candidate.item.startAt) - nextTime);
      const bestDiff = Math.abs(toTimestamp(currentBest.item.startAt) - nextTime);
      return candidateDiff < bestDiff ? candidate : currentBest;
    });

    const matched = remainingPrevious.splice(best.index, 1)[0];
    if (matched) {
      pairs.push({ previous: matched, next: nextItem });
    }
  }

  return pairs;
}

function schedulesMatch(
  previous: NormalizedExistingSchedule,
  next: NormalizedIncomingSchedule,
) {
  return previous.baseHash === next.baseHash;
}

function parseOverridePatch(patch: Record<string, unknown> | null | undefined): {
  startAt: string | null;
  endAt: string | null;
  reason: string | null;
} {
  const asString = (value: unknown) => (typeof value === 'string' ? value : null);
  const normalizeReason = (value: unknown) => {
    const text = asString(value);
    if (!text) return null;
    const trimmed = text.trim();
    return trimmed.length ? trimmed : null;
  };

  if (!patch) {
    return { startAt: null, endAt: null, reason: null };
  }

  const startAt = asString(patch.startAt) ?? asString(patch.start_at);
  const endAt = asString(patch.endAt) ?? asString(patch.end_at);
  const reason = normalizeReason(patch.reason) ?? normalizeReason(patch.description);

  return {
    startAt,
    endAt,
    reason,
  };
}

export function buildLearningSpaceScheduleDiffPlan(input: {
  previousSchedules: ExistingScheduleSnapshot[];
  nextSchedules: LearningSpaceSchedulePayload[] | null | undefined;
  recurrencesByScheduleId?: Map<string, ExistingRecurrenceSnapshot>;
  exceptionsByScheduleId?: Map<string, Map<string, string | null>>;
  overridesByScheduleId?: Map<
    string,
    Map<string, { startAt: string | null; endAt: string | null; reason: string | null }>
  >;
}): LearningSpaceScheduleDiffPlan {
  const previous = normalizeExistingSchedulesForCompare(
    buildExistingScheduleCompareInputs({
      schedules: input.previousSchedules,
      recurrencesByScheduleId: input.recurrencesByScheduleId ?? new Map(),
      exceptionsByScheduleId: input.exceptionsByScheduleId ?? new Map(),
      overridesByScheduleId: input.overridesByScheduleId ?? new Map(),
    }),
  );
  const next = normalizeIncomingSchedulesForCompare(input.nextSchedules);
  const plan: LearningSpaceScheduleDiffPlan = {
    added: [],
    removed: [],
    rescheduled: [],
  };
  const pairCount = Math.min(previous.length, next.length);

  for (let index = 0; index < pairCount; index += 1) {
    const previousSchedule = previous[index];
    const nextSchedule = next[index];
    if (!schedulesMatch(previousSchedule, nextSchedule)) {
      plan.rescheduled.push({
        previous: previousSchedule,
        next: nextSchedule,
      });
    }
  }

  if (previous.length > pairCount) {
    plan.removed.push(...previous.slice(pairCount));
  }

  if (next.length > pairCount) {
    plan.added.push(...next.slice(pairCount));
  }

  return plan;
}

export async function updateLearningSpaceFromPayload(
  learningSpaceId: string,
  payload: LearningSpaceCreatePayload,
  actorContext?: {
    orgId: string;
    actorProfileId: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  let orgId: string;
  let actorProfileId: string;

  if (actorContext) {
    orgId = actorContext.orgId;
    actorProfileId = actorContext.actorProfileId;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const accountResponse = await getAccountByAuthUserId(supabase, user.id);
    if (!accountResponse.data) {
      throw new Error('Account not found');
    }

    const profileResponse = await getProfileByAccountId(
      supabase,
      accountResponse.data.id,
    );
    if (!profileResponse.data) {
      throw new Error('Profile not found');
    }

    orgId = accountResponse.data.org_id;
    actorProfileId = profileResponse.data.id;
  }
  const now = new Date().toISOString();
  const nextParticipantsSnapshot = payload.participants ?? [];

  const { data: learningSpace, error: learningSpaceError } = await supabase
    .from('learning_spaces')
    .select('id, org_id, kind, title, icon_key, subject, description')
    .eq('id', learningSpaceId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (learningSpaceError) {
    throw new Error(learningSpaceError.message);
  }

  if (!learningSpace) {
    throw new Error('Class not found');
  }

  const { data: channelRow, error: channelError } = await supabase
    .from('learning_space_channels')
    .select('channel_id')
    .eq('org_id', orgId)
    .eq('learning_space_id', learningSpaceId)
    .eq('is_primary', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (channelError) {
    throw new Error(channelError.message);
  }

  const channelId = channelRow?.channel_id;
  if (!channelId) {
    throw new Error('Primary channel not found');
  }

  const serviceClient = createSupabaseServiceClient();
  const [
    existingParticipantsResponse,
    existingSchedulesResponse,
    existingRecurrenceResponse,
    existingExceptionsResponse,
    existingOverridesResponse,
    existingLinksResponse,
    channelStateResponse,
  ] = await Promise.all([
    serviceClient
      .from('learning_space_participants')
      .select('profile_id')
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<Array<{ profile_id: string }>>(),
    serviceClient
      .from('class_schedules')
      .select('id, title, start_at, end_at, timezone')
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<ExistingScheduleSnapshot[]>(),
    serviceClient
      .from('class_schedule_recurrence')
      .select(
        'id, schedule_id, frequency, interval, count, until, timezone, bysecond, byminute, byhour, byday, bymonthday, byyearday, byweekno, bymonth, bysetpos, wkst',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<ExistingRecurrenceSnapshot[]>(),
    serviceClient
      .from('class_schedule_recurrence_exceptions')
      .select('recurrence_id, occurrence_key, reason')
      .eq('org_id', orgId)
      .returns<ExistingExceptionSnapshot[]>(),
    serviceClient
      .from('class_schedule_recurrence_overrides')
      .select('recurrence_id, occurrence_key, patch')
      .eq('org_id', orgId)
      .returns<ExistingOverrideSnapshot[]>(),
    serviceClient
      .from('learning_space_links')
      .select('label, icon_key, url, status, hidden')
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<LearningSpaceLinkSnapshotRow[]>(),
    serviceClient
      .from('channels')
      .select(
        'topic, description, icon_key, ui_theme_key, ui_defaults, live_session_config',
      )
      .eq('org_id', orgId)
      .eq('id', channelId)
      .is('deleted_at', null)
      .maybeSingle<{
        topic?: string | null;
        description?: string | null;
        icon_key?: string | null;
        ui_theme_key?: string | null;
        ui_defaults?: unknown;
        live_session_config?: unknown;
      }>(),
  ]);

  if (existingParticipantsResponse.error) {
    throw new Error(existingParticipantsResponse.error.message);
  }
  if (existingSchedulesResponse.error) {
    throw new Error(existingSchedulesResponse.error.message);
  }
  if (existingLinksResponse.error) {
    throw new Error(existingLinksResponse.error.message);
  }
  if (existingRecurrenceResponse.error) {
    throw new Error(existingRecurrenceResponse.error.message);
  }
  if (existingExceptionsResponse.error) {
    throw new Error(existingExceptionsResponse.error.message);
  }
  if (existingOverridesResponse.error) {
    throw new Error(existingOverridesResponse.error.message);
  }
  if (channelStateResponse.error) {
    throw new Error(channelStateResponse.error.message);
  }

  const existingParticipantIdList = normalizeParticipantIds(
    (existingParticipantsResponse.data ?? []).map((row) => row.profile_id),
  );
  const existingParticipantSnapshots = await loadProfileSnapshotsByIds({
    supabase: serviceClient,
    orgId,
    profileIds: existingParticipantIdList,
  });
  const existingParticipantById = new Map(
    existingParticipantSnapshots.map((participant) => [
      participant.profileId,
      participant,
    ]),
  );
  const incomingParticipantIds = normalizeParticipantIds(
    nextParticipantsSnapshot.map((participant) => participant.profileId),
  );
  const hasParticipantChanges =
    canonicalJson(existingParticipantIdList) !== canonicalJson(incomingParticipantIds);

  const hasBasicsChanges =
    (learningSpace.kind ?? null) !== (payload.basics.kind ?? null) ||
    (learningSpace.title ?? null) !== (payload.basics.title ?? null) ||
    (learningSpace.icon_key ?? null) !== (payload.basics.iconKey ?? null) ||
    (learningSpace.subject ?? null) !== (payload.basics.subject ?? null) ||
    (learningSpace.description ?? null) !== (payload.basics.description ?? null);

  const existingChannel = channelStateResponse.data ?? {};
  const hasChannelSettingsChanges =
    (existingChannel.topic ?? null) !== (payload.basics.title ?? null) ||
    (existingChannel.description ?? null) !== (payload.basics.description ?? null) ||
    (existingChannel.icon_key ?? null) !== (payload.basics.iconKey ?? null) ||
    (existingChannel.ui_theme_key ?? null) !== (payload.settings?.themeKey ?? null) ||
    canonicalJson(existingChannel.ui_defaults ?? null) !==
      canonicalJson(payload.settings?.uiDefaults ?? null) ||
    canonicalJson(existingChannel.live_session_config ?? null) !==
      canonicalJson(toStoredLiveSessionConfig(payload.liveSession));

  const hasLinkChanges =
    canonicalJson(normalizeLinksForCompare(existingLinksResponse.data ?? [])) !==
    canonicalJson(normalizeIncomingLinksForCompare(payload.resources ?? []));

  const previousSchedules = existingSchedulesResponse.data ?? [];
  debugScheduleDiff('loaded-raw-rows', {
    learningSpaceId,
    scheduleCount: previousSchedules.length,
    recurrenceCount: (existingRecurrenceResponse.data ?? []).length,
    exceptionRowCount: (existingExceptionsResponse.data ?? []).length,
    overrideRowCount: (existingOverridesResponse.data ?? []).length,
    incomingScheduleCount: (payload.schedules ?? []).length,
  });
  const previousSchedulesById = new Map(
    previousSchedules.map((schedule) => [schedule.id, schedule]),
  );
  const filteredRecurrences = (existingRecurrenceResponse.data ?? []).filter((row) =>
    previousSchedulesById.has(row.schedule_id),
  );
  const recurrenceToScheduleId = new Map(
    filteredRecurrences.map((row) => [row.id, row.schedule_id]),
  );
  const recurrencesByScheduleId = new Map(
    filteredRecurrences.map((row) => [row.schedule_id, row]),
  );
  const previousExceptionsByScheduleId = new Map<string, Map<string, string | null>>();
  for (const row of existingExceptionsResponse.data ?? []) {
    const scheduleId = recurrenceToScheduleId.get(row.recurrence_id);
    if (!scheduleId) continue;
    const current = previousExceptionsByScheduleId.get(scheduleId) ?? new Map();
    current.set(row.occurrence_key, row.reason ?? null);
    previousExceptionsByScheduleId.set(scheduleId, current);
  }
  const previousOverridesByScheduleId = new Map<
    string,
    Map<string, { startAt: string | null; endAt: string | null; reason: string | null }>
  >();
  for (const row of existingOverridesResponse.data ?? []) {
    const scheduleId = recurrenceToScheduleId.get(row.recurrence_id);
    if (!scheduleId) continue;
    const current = previousOverridesByScheduleId.get(scheduleId) ?? new Map();
    current.set(row.occurrence_key, parseOverridePatch(row.patch ?? null));
    previousOverridesByScheduleId.set(scheduleId, current);
  }
  const scheduleDiffPlan = buildLearningSpaceScheduleDiffPlan({
    previousSchedules,
    nextSchedules: payload.schedules ?? [],
    recurrencesByScheduleId,
    exceptionsByScheduleId: previousExceptionsByScheduleId,
    overridesByScheduleId: previousOverridesByScheduleId,
  });
  const previousScheduleCompareInputs = buildExistingScheduleCompareInputs({
    schedules: previousSchedules,
    recurrencesByScheduleId,
    exceptionsByScheduleId: previousExceptionsByScheduleId,
    overridesByScheduleId: previousOverridesByScheduleId,
  });
  const normalizedPreviousSchedules = normalizeExistingSchedulesForCompare(
    previousScheduleCompareInputs,
  );
  const normalizedIncomingSchedules = normalizeIncomingSchedulesForCompare(
    payload.schedules ?? [],
  );
  const nextSessionStartAt = resolveNextSessionStartAtFromIncomingSchedules({
    schedules: normalizedIncomingSchedules,
    nowIso: now,
  });
  const pairedSchedules = pairSchedulesForCompare(
    normalizedPreviousSchedules,
    normalizedIncomingSchedules,
  );
  const exceptionOverrideActivities = buildExceptionAndOverrideScheduleChangeActivities({
    learningSpaceId,
    channelId,
    title: payload.basics.title,
    occurredAt: now,
    invitedMembers: [],
    nextSessionStartAt,
    pairs: pairedSchedules.map((pair) => ({
      scheduleId: pair.previous.id,
      timezone: pair.previous.timezone ?? pair.next.timezone ?? null,
      previousFullHash: pair.previous.fullHash,
      nextFullHash: pair.next.fullHash,
      previous: {
        exceptions: pair.previous.canonical.exceptions.map((entry) => ({
          occurrenceKey: entry.occurrenceKey,
          reason: entry.reason ?? null,
        })),
        overrides: pair.previous.canonical.overrides.map((entry) => ({
          occurrenceKey: entry.occurrenceKey,
          startAt: entry.startAt ?? null,
          endAt: entry.endAt ?? null,
          reason: entry.reason ?? null,
        })),
      },
      next: {
        exceptions: pair.next.canonical.exceptions.map((entry) => ({
          occurrenceKey: entry.occurrenceKey,
          reason: entry.reason ?? null,
        })),
        overrides: pair.next.canonical.overrides.map((entry) => ({
          occurrenceKey: entry.occurrenceKey,
          startAt: entry.startAt ?? null,
          endAt: entry.endAt ?? null,
          reason: entry.reason ?? null,
        })),
      },
    })),
  });
  const previousSchedulesHashKey = buildLearningSpaceSchedulesHashKeyFromExisting(
    previousScheduleCompareInputs,
  );
  const nextSchedulesHashKey = buildLearningSpaceSchedulesHashKeyFromPayload(
    payload.schedules ?? [],
  );
  const hasScheduleHashChanges = previousSchedulesHashKey !== nextSchedulesHashKey;
  debugScheduleDiff('hash-keys', {
    previousSchedulesHashKey,
    nextSchedulesHashKey,
    previousScheduleCount: previousScheduleCompareInputs.length,
    nextScheduleCount: (payload.schedules ?? []).length,
  });
  debugScheduleDiff('paired-compare', {
    pairedCount: pairedSchedules.length,
    pairDiffs: pairedSchedules.map((pair) => ({
      scheduleId: pair.previous.id,
      baseHashEqual: pair.previous.baseHash === pair.next.baseHash,
      fullHashEqual: pair.previous.fullHash === pair.next.fullHash,
      previousBaseHash: pair.previous.baseHash,
      nextBaseHash: pair.next.baseHash,
      previousFullHash: pair.previous.fullHash,
      nextFullHash: pair.next.fullHash,
      previousExceptions: pair.previous.canonical.exceptions.length,
      nextExceptions: pair.next.canonical.exceptions.length,
      previousOverrides: pair.previous.canonical.overrides.length,
      nextOverrides: pair.next.canonical.overrides.length,
    })),
  });
  const hasSemanticScheduleChanges =
    scheduleDiffPlan.added.length > 0 ||
    scheduleDiffPlan.removed.length > 0 ||
    scheduleDiffPlan.rescheduled.length > 0 ||
    exceptionOverrideActivities.length > 0;
  debugScheduleDiff('change-decision', {
    hasScheduleChanges: hasSemanticScheduleChanges,
    hasSemanticScheduleChanges,
    hasScheduleHashChanges,
    exceptionOverrideActivityCount: exceptionOverrideActivities.length,
    addedCount: scheduleDiffPlan.added.length,
    removedCount: scheduleDiffPlan.removed.length,
    rescheduledCount: scheduleDiffPlan.rescheduled.length,
  });

  const hasAnyChanges =
    hasBasicsChanges ||
    hasChannelSettingsChanges ||
    hasParticipantChanges ||
    hasLinkChanges ||
    hasSemanticScheduleChanges;
  const hasInfoChanges = hasBasicsChanges || hasChannelSettingsChanges || hasLinkChanges;

  if (!hasAnyChanges) {
    return;
  }

  await updateLearningSpace(supabase, {
    id: learningSpaceId,
    orgId,
    title: payload.basics.title,
    kind: payload.basics.kind,
    iconKey: payload.basics.iconKey ?? null,
    subject: payload.basics.subject ?? null,
    description: payload.basics.description ?? null,
    updatedBy: actorProfileId,
    updatedAt: now,
  });

  await updateChannel(supabase, {
    id: channelId,
    orgId,
    topic: payload.basics.title,
    description: payload.basics.description ?? null,
    iconKey: payload.basics.iconKey ?? null,
    uiThemeKey: payload.settings?.themeKey ?? null,
    uiDefaults: payload.settings?.uiDefaults ?? null,
    liveSession: payload.liveSession ?? null,
    updatedBy: actorProfileId,
    updatedAt: now,
  });

  await replaceLearningSpaceParticipants(supabase, {
    orgId,
    learningSpaceId,
    createdBy: actorProfileId,
    createdAt: now,
    participants: payload.participants,
  });

  await replaceChannelMembers(supabase, {
    orgId,
    channelId,
    createdBy: actorProfileId,
    createdAt: now,
    participants: payload.participants,
  });

  await replaceLearningSpaceLinks(supabase, {
    orgId,
    learningSpaceId,
    createdBy: actorProfileId,
    createdAt: now,
    links: payload.resources ?? [],
  });

  if (hasSemanticScheduleChanges) {
    await replaceLearningSpaceSchedules(supabase, {
      orgId,
      learningSpaceId,
      channelId,
      createdBy: actorProfileId,
      createdAt: now,
      title: payload.basics.title,
      description: payload.basics.description ?? null,
      themeKey: payload.settings?.themeKey ?? null,
      participants: payload.participants,
      schedules: payload.schedules ?? [],
    });
  }

  if (hasSemanticScheduleChanges) {
    await compileLearningSpaceReminderJobs({
      supabase: serviceClient,
      orgId,
      learningSpaceId,
      compileMode: 'suppress_session_activity',
    });
  }

  const invitedMembersSnapshot = await loadLearningSpaceParticipantSnapshot({
    supabase: serviceClient,
    orgId,
    learningSpaceId,
  });
  const systemProfileId = await ensureSystemProfileId(serviceClient, orgId);

  const infoChangeSummaryParts: string[] = [];
  if ((learningSpace.title ?? null) !== (payload.basics.title ?? null)) {
    infoChangeSummaryParts.push(`Renamed class to ${payload.basics.title}`);
  }
  if ((learningSpace.subject ?? null) !== (payload.basics.subject ?? null)) {
    infoChangeSummaryParts.push(
      payload.basics.subject
        ? `Updated subject to ${payload.basics.subject}`
        : 'Removed subject',
    );
  }
  if ((learningSpace.description ?? null) !== (payload.basics.description ?? null)) {
    infoChangeSummaryParts.push(
      payload.basics.description
        ? 'Updated class description'
        : 'Removed class description',
    );
  }
  if ((learningSpace.kind ?? null) !== (payload.basics.kind ?? null)) {
    infoChangeSummaryParts.push('Changed class type');
  }
  if ((existingChannel.ui_theme_key ?? null) !== (payload.settings?.themeKey ?? null)) {
    infoChangeSummaryParts.push('Updated class theme');
  }
  if (
    canonicalJson(existingChannel.ui_defaults ?? null) !==
    canonicalJson(payload.settings?.uiDefaults ?? null)
  ) {
    infoChangeSummaryParts.push('Updated class defaults');
  }
  if (
    canonicalJson(existingChannel.live_session_config ?? null) !==
    canonicalJson(toStoredLiveSessionConfig(payload.liveSession))
  ) {
    infoChangeSummaryParts.push('Updated live session settings');
  }
  if (hasLinkChanges) {
    infoChangeSummaryParts.push('Updated class resources');
  }
  if (hasSemanticScheduleChanges) {
    const hasRescheduledSessionChanges =
      scheduleDiffPlan.rescheduled.length > 0 ||
      exceptionOverrideActivities.some(
        (activity) => activity.eventType === 'class.session.rescheduled',
      );
    infoChangeSummaryParts.push(
      hasRescheduledSessionChanges ? 'Class rescheduled' : 'Updated class schedule',
    );
  }

  if (hasInfoChanges || hasSemanticScheduleChanges) {
    await publishActivityEvent({
      supabase: serviceClient,
      orgId,
      eventType: 'class.updated',
      occurredAt: now,
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope: { kind: 'learning_space', learningSpaceId },
      targetRef: { kind: 'learning_space', id: learningSpaceId },
      payload: {
        learningSpaceId,
        channelId,
        title: payload.basics.title,
        kind: payload.basics.kind,
        subject: payload.basics.subject ?? null,
        changeSummary: joinNaturalList(infoChangeSummaryParts) || 'Updated class details',
        activityPhase: 'updated',
        invitedCount: invitedMembersSnapshot.length,
        invitedMembers: invitedMembersSnapshot,
      },
      dedupeKey: `class.updated:${learningSpaceId}:${now}`,
      createdBy: systemProfileId,
    });
  }

  const existingParticipantIds = new Set(existingParticipantIdList);
  const nextParticipantIds = new Set(
    nextParticipantsSnapshot.map((participant) => participant.profileId),
  );

  const addedParticipants = nextParticipantsSnapshot.filter(
    (participant) => !existingParticipantIds.has(participant.profileId),
  );
  await publishParticipantInviteActivities({
    supabase: serviceClient,
    orgId,
    actorProfileId: systemProfileId,
    learningSpaceId,
    channelId,
    title: payload.basics.title,
    participants: addedParticipants,
    invitedMembers: invitedMembersSnapshot,
    occurredAt: now,
    activityPhase: 'updated',
    dedupeKey:
      addedParticipants.length > 1
        ? `members.invited:${learningSpaceId}:${now}`
        : `member.invited:${learningSpaceId}:${addedParticipants[0]?.profileId ?? 'unknown'}:${now}`,
  });

  const removedParticipants = [...existingParticipantIds]
    .filter((profileId) => !nextParticipantIds.has(profileId))
    .map((profileId) => ({
      profileId,
      snapshot: existingParticipantById.get(profileId),
    }));

  const removedMembersActivity = buildRemovedMembersActivity({
    learningSpaceId,
    channelId,
    title: payload.basics.title,
    occurredAt: now,
    removedParticipants,
    invitedMembers: invitedMembersSnapshot,
  });
  if (removedMembersActivity) {
    await publishActivityEvent({
      supabase: serviceClient,
      orgId,
      eventType: removedMembersActivity.eventType,
      occurredAt: now,
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope: { kind: 'learning_space', learningSpaceId },
      targetRef: { kind: 'learning_space', id: learningSpaceId },
      payload: removedMembersActivity.payload,
      dedupeKey: removedMembersActivity.dedupeKey,
      createdBy: systemProfileId,
    });
  }
}

type UpdateLearningSpacePayload = {
  id: string;
  orgId: string;
  title: string;
  kind: string;
  iconKey: string | null;
  subject: string | null;
  description: string | null;
  updatedBy: string;
  updatedAt: string;
};

async function updateLearningSpace(
  supabase: SupabaseClient,
  payload: UpdateLearningSpacePayload,
) {
  const { error } = await supabase
    .from('learning_spaces')
    .update({
      title: payload.title,
      kind: payload.kind,
      icon_key: payload.iconKey,
      subject: payload.subject,
      description: payload.description,
      updated_at: payload.updatedAt,
      updated_by: payload.updatedBy,
    })
    .eq('org_id', payload.orgId)
    .eq('id', payload.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

type UpdateChannelPayload = {
  id: string;
  orgId: string;
  topic: string;
  description: string | null;
  iconKey: string | null;
  uiThemeKey: string | null;
  uiDefaults: ChannelUiDefaultsVM | null | undefined;
  liveSession: LearningSpaceCreatePayload['liveSession'];
  updatedBy: string;
  updatedAt: string;
};

async function updateChannel(supabase: SupabaseClient, payload: UpdateChannelPayload) {
  const { error } = await supabase
    .from('channels')
    .update({
      topic: payload.topic,
      description: payload.description,
      icon_key: payload.iconKey,
      ui_theme_key: payload.uiThemeKey,
      ui_defaults: payload.uiDefaults ?? null,
      live_session_config: toStoredLiveSessionConfig(payload.liveSession),
      updated_at: payload.updatedAt,
      updated_by: payload.updatedBy,
    })
    .eq('org_id', payload.orgId)
    .eq('id', payload.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

type ReplaceParticipantsPayload = {
  orgId: string;
  learningSpaceId: string;
  participants: LearningSpaceParticipantPayload[];
  createdBy: string;
  createdAt: string;
};

async function replaceLearningSpaceParticipants(
  supabase: SupabaseClient,
  payload: ReplaceParticipantsPayload,
) {
  await ensureDeleted(
    supabase
      .from('learning_space_participants')
      .delete()
      .eq('org_id', payload.orgId)
      .eq('learning_space_id', payload.learningSpaceId),
  );

  if (!payload.participants.length) {
    return;
  }

  const rows = payload.participants.map((participant) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    learning_space_id: payload.learningSpaceId,
    profile_id: participant.profileId,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { error } = await supabase.from('learning_space_participants').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

type ReplaceChannelMembersPayload = {
  orgId: string;
  channelId: string;
  participants: LearningSpaceParticipantPayload[];
  createdBy: string;
  createdAt: string;
};

async function replaceChannelMembers(
  supabase: SupabaseClient,
  payload: ReplaceChannelMembersPayload,
) {
  await ensureDeleted(
    supabase
      .from('channel_members')
      .delete()
      .eq('org_id', payload.orgId)
      .eq('channel_id', payload.channelId),
  );

  if (!payload.participants.length) {
    return;
  }

  const rows = payload.participants.map((participant) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    channel_id: payload.channelId,
    profile_id: participant.profileId,
    joined_at: payload.createdAt,
    role_in_channel: null,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { error } = await supabase.from('channel_members').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

type ReplaceLinksPayload = {
  orgId: string;
  learningSpaceId: string;
  links: LearningSpaceResourcePayload[];
  createdBy: string;
  createdAt: string;
};

async function replaceLearningSpaceLinks(
  supabase: SupabaseClient,
  payload: ReplaceLinksPayload,
) {
  const serviceClient = createSupabaseServiceClient();

  await ensureDeleted(
    serviceClient
      .from('learning_space_links')
      .delete()
      .eq('org_id', payload.orgId)
      .eq('learning_space_id', payload.learningSpaceId),
  );

  const links = payload.links
    .map((link) => ({
      label: link.label?.trim(),
      iconKey: link.iconKey ?? null,
      url: link.url ?? null,
      status: link.status ?? 'active',
      hidden: link.hidden ?? null,
    }))
    .filter((link) => Boolean(link.label));

  if (!links.length) {
    return;
  }

  const rows = links.map((link) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    learning_space_id: payload.learningSpaceId,
    label: link.label,
    icon_key: link.iconKey,
    url: link.url,
    status: link.status,
    hidden: link.hidden,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { data, error } = await serviceClient
    .from('learning_space_links')
    .insert(rows)
    .select('id');
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error('Unable to insert class links.');
  }
}

type ReplaceSchedulesPayload = {
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
  title: string;
  description: string | null;
  themeKey?: string | null;
  participants: LearningSpaceParticipantPayload[];
  schedules: LearningSpaceCreatePayload['schedules'];
};

export async function replaceLearningSpaceSchedules(
  supabase: SupabaseClient,
  payload: ReplaceSchedulesPayload,
) {
  const serviceClient = createSupabaseServiceClient();
  void supabase;

  const { data: schedules, error } = await serviceClient
    .from('class_schedules')
    .select('id')
    .eq('org_id', payload.orgId)
    .eq('source_learning_space_id', payload.learningSpaceId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }

  const scheduleIds = (schedules ?? []).map((row) => row.id).filter(Boolean);
  await deleteSchedules(serviceClient, payload.orgId, scheduleIds);

  if (!payload.schedules?.length) {
    return;
  }

  await insertClassSchedules(serviceClient, {
    orgId: payload.orgId,
    learningSpaceId: payload.learningSpaceId,
    channelId: payload.channelId,
    createdBy: payload.createdBy,
    createdAt: payload.createdAt,
    title: payload.title,
    description: payload.description,
    themeKey: payload.themeKey ?? null,
    participants: payload.participants,
    schedules: payload.schedules ?? [],
  });
}

async function deleteSchedules(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
) {
  if (!scheduleIds.length) {
    return;
  }

  const { data: recurrenceRows, error: recurrenceError } = await supabase
    .from('class_schedule_recurrence')
    .select('id')
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .is('deleted_at', null);

  if (recurrenceError) {
    throw new Error(recurrenceError.message);
  }

  const recurrenceIds = (recurrenceRows ?? []).map((row) => row.id).filter(Boolean);

  if (recurrenceIds.length) {
    await ensureDeleted(
      supabase
        .from('class_schedule_recurrence_exceptions')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds),
    );

    await ensureDeleted(
      supabase
        .from('class_schedule_recurrence_overrides')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds),
    );
  }

  await ensureDeleted(
    supabase
      .from('class_schedule_recurrence')
      .delete()
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds),
  );

  await ensureDeleted(
    supabase
      .from('class_schedule_participants')
      .delete()
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds),
  );

  await ensureDeleted(
    supabase.from('class_schedules').delete().eq('org_id', orgId).in('id', scheduleIds),
  );
}

async function ensureDeleted(
  request: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await request;
  if (error) {
    throw new Error(error.message);
  }
}
