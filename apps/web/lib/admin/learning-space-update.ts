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

function formatSessionTime(
  isoDateTime: string | null | undefined,
  timezone: string | null | undefined,
) {
  if (!isoDateTime) {
    return null;
  }
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const zone = timezone && timezone.length ? timezone : 'UTC';
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: zone,
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zone,
  }).format(date);
  return { weekday, time };
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

const SCHEDULE_HASH_DEBUG_ENABLED =
  process.env.DEBUG_LEARNING_SPACE_SCHEDULE_HASH === '1';

function debugScheduleHash(stage: string, details: Record<string, unknown>) {
  if (!SCHEDULE_HASH_DEBUG_ENABLED) {
    return;
  }
  // Intentional debug trace for schedule hash drift investigations.
  console.log('[learning-space:update:schedule-hash]', stage, details);
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
) {
  const supabase = await createSupabaseServerClient();
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

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  const orgId = accountResponse.data.org_id;
  const actorProfileId = profileResponse.data.id;
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
    throw new Error('Learning space not found');
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
  debugScheduleHash('loaded-raw-rows', {
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
  debugScheduleHash('hash-keys', {
    previousSchedulesHashKey,
    nextSchedulesHashKey,
    previousScheduleCount: previousScheduleCompareInputs.length,
    nextScheduleCount: (payload.schedules ?? []).length,
  });
  const pairedSchedules = (() => {
    const previous = normalizeExistingSchedulesForCompare(previousScheduleCompareInputs);
    const next = normalizeIncomingSchedulesForCompare(payload.schedules ?? []);
    const pairCount = Math.min(previous.length, next.length);
    const pairs: Array<{
      previous: NormalizedExistingSchedule;
      next: NormalizedIncomingSchedule;
    }> = [];
    for (let index = 0; index < pairCount; index += 1) {
      const previousItem = previous[index];
      const nextItem = next[index];
      if (previousItem && nextItem) {
        pairs.push({ previous: previousItem, next: nextItem });
      }
    }
    return pairs;
  })();
  const hasScheduleHashChanges =
    previousSchedulesHashKey !== nextSchedulesHashKey ||
    pairedSchedules.some((pair) => pair.previous.fullHash !== pair.next.fullHash);
  debugScheduleHash('paired-hash-compare', {
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
  const hasScheduleChanges =
    scheduleDiffPlan.added.length > 0 ||
    scheduleDiffPlan.removed.length > 0 ||
    scheduleDiffPlan.rescheduled.length > 0 ||
    hasScheduleHashChanges;
  debugScheduleHash('change-decision', {
    hasScheduleChanges,
    hasScheduleHashChanges,
    addedCount: scheduleDiffPlan.added.length,
    removedCount: scheduleDiffPlan.removed.length,
    rescheduledCount: scheduleDiffPlan.rescheduled.length,
  });

  const hasAnyChanges =
    hasBasicsChanges ||
    hasChannelSettingsChanges ||
    hasParticipantChanges ||
    hasLinkChanges ||
    hasScheduleChanges;
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

  if (hasScheduleChanges) {
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

  if (hasScheduleChanges) {
    await compileLearningSpaceReminderJobs({
      supabase: serviceClient,
      orgId,
      learningSpaceId,
    });
  }

  const invitedMembersSnapshot = await loadLearningSpaceParticipantSnapshot({
    supabase: serviceClient,
    orgId,
    learningSpaceId,
  });

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

  if (hasInfoChanges) {
    await publishActivityEvent({
      supabase: serviceClient,
      orgId,
      eventType: 'class.updated',
      occurredAt: now,
      sourceKind: 'profile',
      actorProfileId,
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
      createdBy: actorProfileId,
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
    actorProfileId,
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
      sourceKind: 'profile',
      actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId },
      targetRef: { kind: 'learning_space', id: learningSpaceId },
      payload: removedMembersActivity.payload,
      dedupeKey: removedMembersActivity.dedupeKey,
      createdBy: actorProfileId,
    });
  }

  const scheduleChangeLines: string[] = [];
  let cancellationCount = 0;
  let rescheduleCount = 0;

  for (const schedule of scheduleDiffPlan.removed) {
    cancellationCount += 1;
    const oldTime = formatSessionTime(schedule.startAt, schedule.timezone ?? null);
    scheduleChangeLines.push(
      oldTime
        ? `Canceled ${schedule.title} (${oldTime.weekday} ${oldTime.time})`
        : `Canceled ${schedule.title}`,
    );
  }

  for (const schedule of scheduleDiffPlan.added) {
    const newTime = formatSessionTime(schedule.startAt, schedule.timezone ?? null);
    scheduleChangeLines.push(
      newTime ? `Added session (${newTime.weekday} ${newTime.time})` : `Added session`,
    );
  }

  for (const change of scheduleDiffPlan.rescheduled) {
    rescheduleCount += 1;
    const oldTime = formatSessionTime(
      change.previous.startAt,
      change.previous.timezone ?? change.next.timezone ?? null,
    );
    const newTime = formatSessionTime(change.next.startAt, change.next.timezone ?? null);
    scheduleChangeLines.push(
      oldTime && newTime
        ? `${change.previous.title} moved ${oldTime.weekday} ${oldTime.time} -> ${newTime.weekday} ${newTime.time}`
        : `${change.previous.title} was rescheduled`,
    );
  }

  for (const pair of pairedSchedules) {
    const previousExceptions = new Map(
      pair.previous.canonical.exceptions.map((entry) => [entry.occurrenceKey, entry]),
    );
    const nextExceptions = new Map(
      pair.next.canonical.exceptions.map((entry) => [entry.occurrenceKey, entry]),
    );
    for (const [key] of nextExceptions) {
      if (!previousExceptions.has(key)) {
        cancellationCount += 1;
        scheduleChangeLines.push(`Canceled occurrence ${key.slice(0, 16)} via exception`);
      }
    }

    const previousOverrides = new Map(
      pair.previous.canonical.overrides.map((entry) => [entry.occurrenceKey, entry]),
    );
    const nextOverrides = new Map(
      pair.next.canonical.overrides.map((entry) => [entry.occurrenceKey, entry]),
    );

    for (const [occurrenceKey, incoming] of nextOverrides) {
      const previous = previousOverrides.get(occurrenceKey);
      const changed =
        !previous ||
        previous.startAt !== incoming.startAt ||
        previous.endAt !== incoming.endAt ||
        previous.reason !== incoming.reason;
      if (changed) {
        rescheduleCount += 1;
        const oldTime = previous?.startAt
          ? formatSessionTime(
              previous.startAt,
              pair.previous.timezone ?? pair.next.timezone ?? null,
            )
          : null;
        const newTime = incoming.startAt
          ? formatSessionTime(
              incoming.startAt,
              pair.previous.timezone ?? pair.next.timezone ?? null,
            )
          : null;
        scheduleChangeLines.push(
          oldTime && newTime
            ? `${pair.previous.title} override ${oldTime.weekday} ${oldTime.time} -> ${newTime.weekday} ${newTime.time}`
            : `${pair.previous.title} override updated`,
        );
      }
    }
  }

  if (scheduleChangeLines.length > 0) {
    const systemProfileId = await ensureSystemProfileId(serviceClient, orgId);
    const eventType =
      cancellationCount > 0 && rescheduleCount === 0
        ? 'session.canceled'
        : 'session.rescheduled';
    const summaryPrefix = `${scheduleChangeLines.length} schedule changes: ${cancellationCount} cancellations, ${rescheduleCount} reschedules.`;
    const details = scheduleChangeLines.join(' | ');
    await publishActivityEvent({
      supabase: serviceClient,
      orgId,
      eventType,
      occurredAt: now,
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope: { kind: 'learning_space', learningSpaceId },
      targetRef: { kind: 'learning_space', id: learningSpaceId },
      payload: {
        learningSpaceId,
        channelId,
        scheduleId: 'batch',
        title: payload.basics.title,
        activityPhase: 'updated',
        invitedCount: invitedMembersSnapshot.length,
        invitedMembers: invitedMembersSnapshot,
        description: `${summaryPrefix} ${details}`,
        changeSummary: summaryPrefix,
        changeCount: scheduleChangeLines.length,
        previousScheduleHashKey: previousSchedulesHashKey,
        scheduleHashKey: nextSchedulesHashKey,
      },
      dedupeKey: `schedule.updated:${learningSpaceId}:${now}`,
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
    throw new Error('Unable to insert learning space links.');
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
