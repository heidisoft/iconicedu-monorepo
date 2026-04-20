import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { compileLearningSpaceReminderJobs } from '@iconicedu/web/lib/automation/reminder-jobs';
import { ensureSystemProfileId } from '@iconicedu/web/lib/automation/system-profile';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';
import { withInfoPanelDisabled } from '@iconicedu/web/lib/channels/ui-defaults';
import {
  addMinutesToIso,
  buildLearningSpaceSchedulesHashKeyFromPayload,
  buildRRuleFields,
  buildScheduleStart as sharedBuildScheduleStart,
  type RRuleFields,
  toOccurrenceKeyInTimezone,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import type {
  ChannelUiDefaultsVM,
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceScheduleExceptionPayload,
  LearningSpaceScheduleOverridePayload,
  LearningSpaceSchedulePayload,
  LearningSpaceScheduleRulePayload,
} from '@iconicedu/shared-types';

const LEARNING_SPACE_CHANNEL_CAPABILITIES = [
  'has_schedule',
  'has_homework',
  'has_summaries',
] as const;

type CreateLearningSpaceResult = {
  learningSpaceId: string;
  channelId: string;
  scheduleIds: string[];
};

export async function createLearningSpaceFromPayload(
  payload: LearningSpaceCreatePayload,
): Promise<CreateLearningSpaceResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);

  const orgId = actor.account.org_id;
  const actorProfileId = actor.profile.id;
  const now = new Date().toISOString();

  const learningSpaceId = randomUUID();
  await insertLearningSpace(supabase, {
    id: learningSpaceId,
    orgId,
    kind: payload.basics.kind,
    title: payload.basics.title,
    iconKey: payload.basics.iconKey ?? null,
    subject: payload.basics.subject ?? null,
    description: payload.basics.description ?? null,
    createdBy: actorProfileId,
    createdAt: now,
  });

  const channelId = randomUUID();
  await insertChannel(supabase, {
    id: channelId,
    orgId,
    topic: payload.basics.title,
    description: payload.basics.description ?? null,
    iconKey: payload.basics.iconKey ?? null,
    uiThemeKey: payload.settings?.themeKey ?? null,
    uiDefaults: payload.settings?.uiDefaults ?? null,
    liveSession: payload.liveSession ?? null,
    primaryEntityId: learningSpaceId,
    createdByProfileId: actorProfileId,
    createdAt: now,
  });

  await insertLearningSpaceChannel(supabase, {
    id: randomUUID(),
    orgId,
    learningSpaceId,
    channelId,
    createdBy: actorProfileId,
    createdAt: now,
  });

  await insertLearningSpaceParticipants(supabase, {
    orgId,
    learningSpaceId,
    createdBy: actorProfileId,
    createdAt: now,
    participants: payload.participants,
  });

  await insertChannelMembers(supabase, {
    orgId,
    channelId,
    createdBy: actorProfileId,
    createdAt: now,
    participants: payload.participants,
  });

  await insertChannelCapabilities(supabase, {
    orgId,
    channelId,
    createdBy: actorProfileId,
    createdAt: now,
  });

  const scheduleIds = await insertClassSchedules(supabase, {
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

  const serviceClient = createSupabaseServiceClient();
  const systemProfileId = await ensureSystemProfileId(serviceClient, orgId);
  await compileLearningSpaceReminderJobs({
    supabase: serviceClient,
    orgId,
    learningSpaceId,
  });

  return { learningSpaceId, channelId, scheduleIds };
}

type LearningSpaceInsertPayload = {
  id: string;
  orgId: string;
  kind: string;
  title: string;
  iconKey: string | null;
  subject: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
};

async function insertLearningSpace(
  supabase: SupabaseClient,
  payload: LearningSpaceInsertPayload,
) {
  const { error } = await supabase.from('learning_spaces').insert({
    id: payload.id,
    org_id: payload.orgId,
    kind: payload.kind,
    status: 'active',
    title: payload.title,
    icon_key: payload.iconKey,
    subject: payload.subject,
    description: payload.description,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  });

  if (error) {
    throw new Error(error.message);
  }
}

type ChannelInsertPayload = {
  id: string;
  orgId: string;
  topic: string;
  iconKey: string | null;
  description: string | null;
  uiThemeKey: string | null;
  uiDefaults: ChannelUiDefaultsVM | null | undefined;
  liveSession: LearningSpaceCreatePayload['liveSession'];
  primaryEntityId: string;
  createdByProfileId: string;
  createdAt: string;
};

async function insertChannel(supabase: SupabaseClient, payload: ChannelInsertPayload) {
  const { error } = await supabase.from('channels').insert({
    id: payload.id,
    org_id: payload.orgId,
    kind: 'channel',
    topic: payload.topic,
    icon_key: payload.iconKey,
    description: payload.description,
    visibility: 'private',
    purpose: 'learning-space',
    status: 'active',
    posting_policy_kind: 'members-only',
    allow_threads: true,
    allow_reactions: true,
    ui_theme_key: payload.uiThemeKey,
    ui_defaults: withInfoPanelDisabled(payload.uiDefaults),
    live_session_config: toStoredLiveSessionConfig(payload.liveSession),
    primary_entity_kind: 'learning_space',
    primary_entity_id: payload.primaryEntityId,
    created_by_profile_id: payload.createdByProfileId,
    created_at: payload.createdAt,
    created_by: payload.createdByProfileId,
    updated_at: payload.createdAt,
    updated_by: payload.createdByProfileId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

type LearningSpaceChannelInsertPayload = {
  id: string;
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
};

async function insertLearningSpaceChannel(
  supabase: SupabaseClient,
  payload: LearningSpaceChannelInsertPayload,
) {
  const { error } = await supabase.from('learning_space_channels').insert({
    id: payload.id,
    org_id: payload.orgId,
    learning_space_id: payload.learningSpaceId,
    channel_id: payload.channelId,
    is_primary: true,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  });

  if (error) {
    throw new Error(error.message);
  }
}

type LearningSpaceParticipantsInsertPayload = {
  orgId: string;
  learningSpaceId: string;
  participants: LearningSpaceParticipantPayload[];
  createdBy: string;
  createdAt: string;
};

async function insertLearningSpaceParticipants(
  supabase: SupabaseClient,
  payload: LearningSpaceParticipantsInsertPayload,
) {
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

type ChannelMembersInsertPayload = {
  orgId: string;
  channelId: string;
  participants: LearningSpaceParticipantPayload[];
  createdBy: string;
  createdAt: string;
};

async function insertChannelMembers(
  supabase: SupabaseClient,
  payload: ChannelMembersInsertPayload,
) {
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

type ChannelCapabilitiesInsertPayload = {
  orgId: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
};

async function insertChannelCapabilities(
  supabase: SupabaseClient,
  payload: ChannelCapabilitiesInsertPayload,
) {
  const rows = LEARNING_SPACE_CHANNEL_CAPABILITIES.map((capability) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    channel_id: payload.channelId,
    capability,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { error } = await supabase.from('channel_capabilities').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

type ClassScheduleInsertPayload = {
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
  title: string;
  description: string | null;
  themeKey?: string | null;
  participants: LearningSpaceParticipantPayload[];
  schedules: LearningSpaceSchedulePayload[];
};

type ExpandedSchedule = {
  startAt: string;
  endAt: string;
  time: string;
};

export const buildScheduleStart = sharedBuildScheduleStart;

export async function insertClassSchedules(
  supabase: SupabaseClient,
  payload: ClassScheduleInsertPayload,
): Promise<string[]> {
  if (!payload.schedules.length) {
    return [];
  }

  const scheduleIds: string[] = [];

  for (const schedule of payload.schedules) {
    const expanded = buildScheduleStart(schedule);
    const scheduleId = randomUUID();
    scheduleIds.push(scheduleId);

    const { error: scheduleError } = await supabase.from('class_schedules').insert({
      id: scheduleId,
      org_id: payload.orgId,
      title: payload.title,
      description: payload.description,
      location: null,
      meeting_link: null,
      start_at: expanded.startAt,
      end_at: expanded.endAt,
      timezone: schedule.timezone,
      status: 'scheduled',
      visibility: 'class-members',
      theme_key: payload.themeKey ?? null,
      source_kind: 'class_session',
      source_learning_space_id: payload.learningSpaceId,
      source_channel_id: payload.channelId,
      created_at: payload.createdAt,
      created_by: payload.createdBy,
      updated_at: payload.createdAt,
      updated_by: payload.createdBy,
    });

    if (scheduleError) {
      throw new Error(scheduleError.message);
    }

    await insertClassScheduleParticipants(supabase, {
      orgId: payload.orgId,
      scheduleId,
      createdBy: payload.createdBy,
      createdAt: payload.createdAt,
      participants: payload.participants,
    });

    if (schedule.rule) {
      const recurrenceId = randomUUID();
      await insertClassScheduleRecurrence(supabase, {
        id: recurrenceId,
        orgId: payload.orgId,
        scheduleId,
        createdBy: payload.createdBy,
        createdAt: payload.createdAt,
        rule: schedule.rule,
        timezone: schedule.timezone,
        startDate: schedule.startDate,
      });

      await insertClassScheduleRecurrenceExceptions(supabase, {
        orgId: payload.orgId,
        recurrenceId,
        createdBy: payload.createdBy,
        createdAt: payload.createdAt,
        exceptions: schedule.exceptions ?? [],
        time: expanded.time,
        timezone: schedule.timezone ?? schedule.rule.timezone ?? null,
      });

      await insertClassScheduleRecurrenceOverrides(supabase, {
        orgId: payload.orgId,
        recurrenceId,
        createdBy: payload.createdBy,
        createdAt: payload.createdAt,
        overrides: schedule.overrides ?? [],
        time: expanded.time,
        endTime: schedule.endTime,
        timezone: schedule.timezone ?? schedule.rule.timezone ?? null,
      });
    }
  }

  return scheduleIds;
}

type ClassScheduleParticipantsInsertPayload = {
  orgId: string;
  scheduleId: string;
  participants: LearningSpaceParticipantPayload[];
  createdBy: string;
  createdAt: string;
};

async function insertClassScheduleParticipants(
  supabase: SupabaseClient,
  payload: ClassScheduleParticipantsInsertPayload,
) {
  const scheduleParticipants = payload.participants.filter(
    (participant) => participant.kind === 'educator' || participant.kind === 'child',
  );

  if (!scheduleParticipants.length) {
    return;
  }

  const rows = scheduleParticipants.map((participant) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    schedule_id: payload.scheduleId,
    profile_id: participant.profileId,
    role: participant.kind,
    status: 'accepted',
    display_name: participant.displayName,
    avatar_url: participant.avatarUrl ?? null,
    theme_key: participant.themeKey ?? null,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { error } = await supabase.from('class_schedule_participants').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

type ClassScheduleRecurrenceInsertPayload = {
  id: string;
  orgId: string;
  scheduleId: string;
  createdBy: string;
  createdAt: string;
  rule: LearningSpaceScheduleRulePayload;
  timezone: string;
  startDate: string;
};

async function insertClassScheduleRecurrence(
  supabase: SupabaseClient,
  payload: ClassScheduleRecurrenceInsertPayload,
) {
  const rruleFields = buildRRuleFields(
    payload.rule,
    payload.startDate,
    payload.timezone ?? payload.rule.timezone ?? 'UTC',
  );
  const rawRRule = buildRawRRule(payload.rule, rruleFields);

  const { error } = await supabase.from('class_schedule_recurrence').insert({
    id: payload.id,
    org_id: payload.orgId,
    schedule_id: payload.scheduleId,
    frequency: payload.rule.frequency,
    interval: payload.rule.interval ?? null,
    count: payload.rule.count ?? null,
    until: payload.rule.until ?? null,
    timezone: payload.timezone ?? payload.rule.timezone ?? null,
    raw_rrule: rawRRule,
    bysecond: rruleFields.bysecond,
    byminute: rruleFields.byminute,
    byhour: rruleFields.byhour,
    byday: rruleFields.byday,
    bymonthday: rruleFields.bymonthday,
    byyearday: rruleFields.byyearday,
    byweekno: rruleFields.byweekno,
    bymonth: rruleFields.bymonth,
    bysetpos: rruleFields.bysetpos,
    wkst: rruleFields.wkst,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  });

  if (error) {
    throw new Error(error.message);
  }
}

type ClassScheduleRecurrenceExceptionsInsertPayload = {
  orgId: string;
  recurrenceId: string;
  exceptions: LearningSpaceScheduleExceptionPayload[];
  time: string;
  timezone: string | null;
  createdBy: string;
  createdAt: string;
};

async function insertClassScheduleRecurrenceExceptions(
  supabase: SupabaseClient,
  payload: ClassScheduleRecurrenceExceptionsInsertPayload,
) {
  if (!payload.exceptions.length) {
    return;
  }

  const rows = payload.exceptions.map((exception) => ({
    id: randomUUID(),
    org_id: payload.orgId,
    recurrence_id: payload.recurrenceId,
    occurrence_key: toOccurrenceKeyInTimezone(
      exception.date,
      payload.time,
      payload.timezone,
    ),
    reason: exception.reason ?? null,
    created_at: payload.createdAt,
    created_by: payload.createdBy,
    updated_at: payload.createdAt,
    updated_by: payload.createdBy,
  }));

  const { error } = await supabase
    .from('class_schedule_recurrence_exceptions')
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

type ClassScheduleRecurrenceOverridesInsertPayload = {
  orgId: string;
  recurrenceId: string;
  overrides: LearningSpaceScheduleOverridePayload[];
  time: string;
  endTime: string;
  timezone: string | null;
  createdBy: string;
  createdAt: string;
};

async function insertClassScheduleRecurrenceOverrides(
  supabase: SupabaseClient,
  payload: ClassScheduleRecurrenceOverridesInsertPayload,
) {
  if (!payload.overrides.length) {
    return;
  }

  const [baseStartHour, baseStartMinute] = payload.time
    .split(':')
    .map((value) => Number(value));
  const [baseEndHour, baseEndMinute] = payload.endTime
    .split(':')
    .map((value) => Number(value));
  const baseStartMinutes = (baseStartHour ?? 0) * 60 + (baseStartMinute ?? 0);
  let baseEndMinutes = (baseEndHour ?? 0) * 60 + (baseEndMinute ?? 0);
  if (baseEndMinutes <= baseStartMinutes) {
    baseEndMinutes += 24 * 60;
  }
  const baseDurationMinutes = Math.max(1, baseEndMinutes - baseStartMinutes);

  const rows = payload.overrides.map((override) => {
    const time = override.newTime ?? payload.time;
    const startAt = toOccurrenceKeyInTimezone(override.newDate, time, payload.timezone);
    const endAt =
      override.newEndTime != null
        ? toOccurrenceKeyInTimezone(
            override.newDate,
            override.newEndTime,
            payload.timezone,
          )
        : addMinutesToIso(startAt, baseDurationMinutes);
    const patch: Record<string, unknown> = { startAt, endAt };

    if (override.reason) {
      patch.reason = override.reason;
    }

    return {
      id: randomUUID(),
      org_id: payload.orgId,
      recurrence_id: payload.recurrenceId,
      occurrence_key: toOccurrenceKeyInTimezone(
        override.originalDate,
        payload.time,
        payload.timezone,
      ),
      patch,
      created_at: payload.createdAt,
      created_by: payload.createdBy,
      updated_at: payload.createdAt,
      updated_by: payload.createdBy,
    };
  });

  const { error } = await supabase
    .from('class_schedule_recurrence_overrides')
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

function buildRawRRule(rule: LearningSpaceScheduleRulePayload, fields: RRuleFields) {
  const parts: string[] = [`FREQ=${rule.frequency.toUpperCase()}`];

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (fields.bysecond?.length) {
    parts.push(`BYSECOND=${fields.bysecond.join(',')}`);
  }
  if (fields.byminute?.length) {
    parts.push(`BYMINUTE=${fields.byminute.join(',')}`);
  }
  if (fields.byhour?.length) {
    parts.push(`BYHOUR=${fields.byhour.join(',')}`);
  }
  if (fields.byday?.length) {
    parts.push(`BYDAY=${fields.byday.join(',')}`);
  }
  if (fields.bymonthday?.length) {
    parts.push(`BYMONTHDAY=${fields.bymonthday.join(',')}`);
  }
  if (fields.byyearday?.length) {
    parts.push(`BYYEARDAY=${fields.byyearday.join(',')}`);
  }
  if (fields.byweekno?.length) {
    parts.push(`BYWEEKNO=${fields.byweekno.join(',')}`);
  }
  if (fields.bymonth?.length) {
    parts.push(`BYMONTH=${fields.bymonth.join(',')}`);
  }
  if (fields.bysetpos?.length) {
    parts.push(`BYSETPOS=${fields.bysetpos.join(',')}`);
  }
  if (fields.wkst) {
    parts.push(`WKST=${fields.wkst}`);
  }
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }
  if (rule.until) {
    parts.push(`UNTIL=${formatUtcDateTime(new Date(rule.until))}`);
  }

  return parts.join(';');
}

function formatUtcDateTime(date: Date) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(
    date.getUTCDate(),
  )}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(
    date.getUTCSeconds(),
  )}Z`;
}

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}
