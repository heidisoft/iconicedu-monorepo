import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import type {
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceResourcePayload,
  LearningSpaceScheduleExceptionPayload,
  LearningSpaceScheduleOverridePayload,
  LearningSpaceSchedulePayload,
  LearningSpaceScheduleRulePayload,
  LearningSpaceScheduleWeekdayTimePayload,
} from '@iconicedu/shared-types';

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_START_TIME = '09:00';
const LEARNING_SPACE_CHANNEL_CAPABILITIES = [
  'has_schedule',
  'has_homework',
  'has_summaries',
] as const;

const WEEKDAY_INDEX: Record<WeekdayValue, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

type WeekdayValue = LearningSpaceScheduleWeekdayTimePayload['day'];

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

  await insertLearningSpaceLinks(supabase, {
    orgId,
    learningSpaceId,
    createdBy: actorProfileId,
    createdAt: now,
    links: payload.resources ?? [],
  });

  const scheduleIds = await insertClassSchedules(supabase, {
    orgId,
    learningSpaceId,
    channelId,
    createdBy: actorProfileId,
    createdAt: now,
    title: payload.basics.title,
    description: payload.basics.description ?? null,
    participants: payload.participants,
    schedules: payload.schedules ?? [],
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

type LearningSpaceLinksInsertPayload = {
  orgId: string;
  learningSpaceId: string;
  links: LearningSpaceResourcePayload[];
  createdBy: string;
  createdAt: string;
};

async function insertLearningSpaceLinks(
  supabase: SupabaseClient,
  payload: LearningSpaceLinksInsertPayload,
) {
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

  const serviceClient = createSupabaseServiceClient();
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

type ClassScheduleInsertPayload = {
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
  title: string;
  description: string | null;
  participants: LearningSpaceParticipantPayload[];
  schedules: LearningSpaceSchedulePayload[];
};

type ExpandedSchedule = {
  startAt: string;
  endAt: string;
  time: string;
};

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
      theme_key: null,
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
    });

    await insertClassScheduleRecurrenceOverrides(supabase, {
      orgId: payload.orgId,
      recurrenceId,
      createdBy: payload.createdBy,
      createdAt: payload.createdAt,
      overrides: schedule.overrides ?? [],
      time: expanded.time,
    });
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
  const rruleFields = buildRRuleFields(payload.rule, payload.startDate);
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
    occurrence_key: toOccurrenceKey(exception.date, payload.time),
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

  const rows = payload.overrides.map((override) => {
    const time = override.newTime ?? payload.time;
    const startAt = toOccurrenceKey(override.newDate, time);
    const endAt = addMinutes(startAt, DEFAULT_DURATION_MINUTES);
    const patch: Record<string, unknown> = { startAt, endAt };

    if (override.reason) {
      patch.reason = override.reason;
    }

    return {
      id: randomUUID(),
      org_id: payload.orgId,
      recurrence_id: payload.recurrenceId,
      occurrence_key: toOccurrenceKey(override.originalDate, payload.time),
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

function buildScheduleStart(schedule: LearningSpaceSchedulePayload): ExpandedSchedule {
  const startDate = new Date(schedule.startDate);
  startDate.setHours(0, 0, 0, 0);

  const times = normalizeWeekdayTimes(schedule);
  if (!times.length) {
    const startAt = applyTime(startDate, DEFAULT_START_TIME);
    return buildExpandedSchedule(startAt, DEFAULT_START_TIME);
  }

  const candidates = times.map((entry) => {
    const dateForWeekday = getNextWeekdayDate(startDate, entry.day);
    const startAt = applyTime(dateForWeekday, entry.time);
    return buildExpandedSchedule(startAt, entry.time);
  });

  return candidates.reduce((earliest, candidate) =>
    candidate.startAt < earliest.startAt ? candidate : earliest,
  );
}

function normalizeWeekdayTimes(
  schedule: LearningSpaceSchedulePayload,
): LearningSpaceScheduleWeekdayTimePayload[] {
  if (schedule.rule.weekdayTimes?.length) {
    return schedule.rule.weekdayTimes;
  }

  if (schedule.rule.byWeekday?.length) {
    return schedule.rule.byWeekday.map((day) => ({ day, time: DEFAULT_START_TIME }));
  }

  const weekday = toWeekdayValue(new Date(schedule.startDate));
  return weekday ? [{ day: weekday, time: DEFAULT_START_TIME }] : [];
}

type RRuleFields = {
  bysecond: number[] | null;
  byminute: number[] | null;
  byhour: number[] | null;
  byday: WeekdayValue[] | null;
  bymonthday: number[] | null;
  byyearday: number[] | null;
  byweekno: number[] | null;
  bymonth: number[] | null;
  bysetpos: number[] | null;
  wkst: WeekdayValue;
};

function buildRRuleFields(
  rule: LearningSpaceScheduleRulePayload,
  startDate: string,
): RRuleFields {
  const weekdayTimes = rule.weekdayTimes ?? [];
  const byday =
    rule.byWeekday?.length
      ? rule.byWeekday
      : weekdayTimes.length
        ? weekdayTimes.map((entry) => entry.day)
        : null;

  const times = weekdayTimes.length
    ? weekdayTimes.map((entry) => entry.time)
    : rule.frequency !== 'weekly'
      ? [getTimeFromISO(startDate)]
      : [];

  const hours = new Set<number>();
  const minutes = new Set<number>();
  times.forEach((time) => {
    const [hour, minute] = time.split(':').map((value) => Number(value));
    if (!Number.isNaN(hour)) hours.add(hour);
    if (!Number.isNaN(minute)) minutes.add(minute);
  });

  return {
    bysecond: null,
    byminute: minutes.size ? Array.from(minutes).sort((a, b) => a - b) : null,
    byhour: hours.size ? Array.from(hours).sort((a, b) => a - b) : null,
    byday: byday?.length ? (Array.from(new Set(byday)) as WeekdayValue[]) : null,
    bymonthday: null,
    byyearday: null,
    byweekno: null,
    bymonth: null,
    bysetpos: null,
    wkst: 'MO',
  };
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

function getTimeFromISO(isoDateTime: string) {
  const date = new Date(isoDateTime);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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

function toWeekdayValue(date: Date): WeekdayValue | null {
  const dayIndex = date.getDay();
  const entry = Object.entries(WEEKDAY_INDEX).find(([, value]) => value === dayIndex);
  return entry ? (entry[0] as WeekdayValue) : null;
}

function getNextWeekdayDate(startDate: Date, weekday: WeekdayValue) {
  const targetIndex = WEEKDAY_INDEX[weekday];
  const currentIndex = startDate.getDay();
  const diff = (targetIndex - currentIndex + 7) % 7;
  const date = new Date(startDate);
  date.setDate(date.getDate() + diff);
  return date;
}

function applyTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const withTime = new Date(date);
  withTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return withTime;
}

function buildExpandedSchedule(
  startAtDate: Date,
  time: string,
): ExpandedSchedule {
  const startAt = startAtDate.toISOString();
  return {
    startAt,
    endAt: addMinutes(startAt, DEFAULT_DURATION_MINUTES),
    time,
  };
}

function addMinutes(isoDateTime: string, minutes: number) {
  const date = new Date(isoDateTime);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function toOccurrenceKey(isoDate: string, time: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number(value));
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0);
  return date.toISOString();
}
