import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { insertClassSchedules } from '@iconicedu/web/lib/admin/learning-space-create';
import {
  type CanonicalLearningSpaceSchedule,
  buildCanonicalLearningSpaceSchedulesFromExisting,
  buildCanonicalLearningSpaceSchedulesFromPayload,
  buildLearningSpaceScheduleHashBundleFromCanonical,
  buildLearningSpaceSchedulesHashKeyFromExisting,
  buildLearningSpaceSchedulesHashKeyFromPayload,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';
import { FEED_MESSAGE_UI_THEME_KEY } from '@iconicedu/web/lib/channels/ui-defaults';
import type {
  ChannelUiDefaultsVM,
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceSchedulePayload,
} from '@iconicedu/shared-types';

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

type SchedulePairingReason =
  | 'exact_structural'
  | 'fallback_nearest_same_timezone'
  | 'fallback_nearest_any_timezone';

type SchedulePairingResult = {
  pairs: Array<{
    previous: NormalizedExistingSchedule;
    next: NormalizedIncomingSchedule;
    reason: SchedulePairingReason;
  }>;
  unpairedPrevious: NormalizedExistingSchedule[];
  unpairedNext: NormalizedIncomingSchedule[];
};

function durationMinutesBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return Math.max(1, Math.round((end - start) / 60000));
}

function buildStructuralSignature(
  schedule: NormalizedExistingSchedule | NormalizedIncomingSchedule,
) {
  return JSON.stringify({
    timezone: schedule.timezone ?? null,
    recurrence: schedule.canonical.recurrence,
    durationMinutes: durationMinutesBetween(schedule.startAt, schedule.endAt),
  });
}

function toTimeOrZero(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(normalizeForCompare(value));
}

function withLearningSpaceMessageUiTheme(
  uiDefaults?: ChannelUiDefaultsVM | null,
): ChannelUiDefaultsVM {
  return {
    ...(uiDefaults ?? {}),
    messageUiThemeKey: uiDefaults?.messageUiThemeKey ?? FEED_MESSAGE_UI_THEME_KEY,
  };
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

function normalizeParticipantIds(ids: string[]) {
  return [...ids].sort();
}

function isScheduleDiffDebugEnabled() {
  return process.env.DEBUG_LEARNING_SPACE_SCHEDULE_DIFF === '1';
}

function debugScheduleDiff(_stage: string, _details: Record<string, unknown>) {
  if (!isScheduleDiffDebugEnabled()) {
    return;
  }
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
): SchedulePairingResult {
  const remainingPrevious = [...previous];
  const remainingNext = [...next];
  const pairs: SchedulePairingResult['pairs'] = [];

  const selectNearest = (
    candidates: Array<{ item: NormalizedExistingSchedule; index: number }>,
    nextItem: NormalizedIncomingSchedule,
  ) => {
    const nextTime = toTimeOrZero(nextItem.startAt);
    return candidates.reduce((currentBest, candidate) => {
      const candidateDiff = Math.abs(toTimeOrZero(candidate.item.startAt) - nextTime);
      const bestDiff = Math.abs(toTimeOrZero(currentBest.item.startAt) - nextTime);
      if (candidateDiff !== bestDiff) {
        return candidateDiff < bestDiff ? candidate : currentBest;
      }
      return candidate.index < currentBest.index ? candidate : currentBest;
    });
  };

  // Pass 1: exact structural signature match.
  for (let nextIndex = 0; nextIndex < remainingNext.length; ) {
    const nextItem = remainingNext[nextIndex];
    const signature = buildStructuralSignature(nextItem);
    const exactCandidates = remainingPrevious
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => buildStructuralSignature(item) === signature);

    if (!exactCandidates.length) {
      nextIndex += 1;
      continue;
    }

    const best = selectNearest(exactCandidates, nextItem);
    const matched = remainingPrevious.splice(best.index, 1)[0];
    if (matched) {
      pairs.push({
        previous: matched,
        next: nextItem,
        reason: 'exact_structural',
      });
    }
    remainingNext.splice(nextIndex, 1);
  }

  // Pass 2: fallback nearest match, preferring same timezone.
  for (let nextIndex = 0; nextIndex < remainingNext.length; ) {
    const nextItem = remainingNext[nextIndex];
    const sameTimezoneCandidates = remainingPrevious
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (item.timezone ?? 'UTC') === (nextItem.timezone ?? 'UTC'));
    const fallbackCandidates = remainingPrevious.map((item, index) => ({ item, index }));
    const selectedCandidates = sameTimezoneCandidates.length
      ? sameTimezoneCandidates
      : fallbackCandidates;

    if (!selectedCandidates.length) {
      nextIndex += 1;
      continue;
    }

    const best = selectNearest(selectedCandidates, nextItem);
    const matched = remainingPrevious.splice(best.index, 1)[0];
    if (matched) {
      pairs.push({
        previous: matched,
        next: nextItem,
        reason: sameTimezoneCandidates.length
          ? 'fallback_nearest_same_timezone'
          : 'fallback_nearest_any_timezone',
      });
    }
    remainingNext.splice(nextIndex, 1);
  }

  return {
    pairs,
    unpairedPrevious: remainingPrevious,
    unpairedNext: remainingNext,
  };
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

  const pairing = pairSchedulesForCompare(previous, next);

  for (const pair of pairing.pairs) {
    const previousSchedule = pair.previous;
    const nextSchedule = pair.next;
    if (!schedulesMatch(previousSchedule, nextSchedule)) {
      plan.rescheduled.push({
        previous: previousSchedule,
        next: nextSchedule,
      });
    }
  }

  plan.removed.push(...pairing.unpairedPrevious);
  plan.added.push(...pairing.unpairedNext);

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
    const actor = await requireParentActorContext(supabase);
    orgId = actor.account.org_id;
    actorProfileId = actor.profile.id;
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
  const nextChannelUiDefaults = withLearningSpaceMessageUiTheme(
    payload.settings?.uiDefaults ?? null,
  );
  const hasChannelSettingsChanges =
    (existingChannel.topic ?? null) !== (payload.basics.title ?? null) ||
    (existingChannel.description ?? null) !== (payload.basics.description ?? null) ||
    (existingChannel.icon_key ?? null) !== (payload.basics.iconKey ?? null) ||
    (existingChannel.ui_theme_key ?? null) !== (payload.settings?.themeKey ?? null) ||
    canonicalJson(existingChannel.ui_defaults ?? null) !==
      canonicalJson(nextChannelUiDefaults) ||
    canonicalJson(existingChannel.live_session_config ?? null) !==
      canonicalJson(toStoredLiveSessionConfig(payload.liveSession));

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
  const hasSemanticScheduleChanges = hasScheduleHashChanges;
  debugScheduleDiff('change-decision', {
    hasScheduleChanges: hasSemanticScheduleChanges,
    hasSemanticScheduleChanges,
    hasScheduleHashChanges,
    addedCount: scheduleDiffPlan.added.length,
    removedCount: scheduleDiffPlan.removed.length,
    rescheduledCount: scheduleDiffPlan.rescheduled.length,
  });

  const hasAnyChanges =
    hasBasicsChanges ||
    hasChannelSettingsChanges ||
    hasParticipantChanges ||
    hasSemanticScheduleChanges;

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
    uiDefaults: nextChannelUiDefaults,
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
    const api = createApiClient(supabase);
    await api.post('/reminders/learning-space/compile', {
      orgId,
      learningSpaceId,
    });
  }

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
    canonicalJson(nextChannelUiDefaults)
  ) {
    infoChangeSummaryParts.push('Updated class defaults');
  }
  if (
    canonicalJson(existingChannel.live_session_config ?? null) !==
    canonicalJson(toStoredLiveSessionConfig(payload.liveSession))
  ) {
    infoChangeSummaryParts.push('Updated live session settings');
  }
  if (hasSemanticScheduleChanges) {
    infoChangeSummaryParts.push('Class schedule has been updated');
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
