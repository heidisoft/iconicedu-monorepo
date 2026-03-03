import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { insertClassSchedules } from '@iconicedu/web/lib/admin/learning-space-create';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import type {
  ChannelUiDefaultsVM,
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceResourcePayload,
  LearningSpaceSchedulePayload,
} from '@iconicedu/shared-types';

type ExpandedSchedule = {
  startAt: string;
  endAt: string;
};

function buildScheduleStartForActivity(
  schedule: LearningSpaceSchedulePayload,
): ExpandedSchedule {
  const baseDate = new Date(schedule.startDate);
  const weekdayTime = schedule.rule.weekdayTimes?.[0];
  const time = weekdayTime?.time ?? '09:00';
  const [hour, minute] = time
    .split(':')
    .map((value: string) => Number.parseInt(value, 10));
  baseDate.setUTCHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  const endDate = new Date(baseDate.getTime() + 60 * 60 * 1000);
  return {
    startAt: baseDate.toISOString(),
    endAt: endDate.toISOString(),
  };
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

  const { data: learningSpace, error: learningSpaceError } = await supabase
    .from('learning_spaces')
    .select('id, org_id')
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
  const [existingParticipantsResponse, existingSchedulesResponse] = await Promise.all([
    serviceClient
      .from('learning_space_participants')
      .select('profile_id')
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<Array<{ profile_id: string }>>(),
    serviceClient
      .from('class_schedules')
      .select('id, title, start_at, end_at')
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<Array<{ id: string; title: string; start_at: string; end_at: string }>>(),
  ]);

  if (existingParticipantsResponse.error) {
    throw new Error(existingParticipantsResponse.error.message);
  }
  if (existingSchedulesResponse.error) {
    throw new Error(existingSchedulesResponse.error.message);
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
      changeSummary: 'Class details updated',
    },
    dedupeKey: `class.updated:${learningSpaceId}:${now}`,
    createdBy: actorProfileId,
  });

  const existingParticipantIds = new Set(
    (existingParticipantsResponse.data ?? []).map((row) => row.profile_id),
  );
  const nextParticipants = payload.participants ?? [];
  const nextParticipantIds = new Set(nextParticipants.map((participant) => participant.profileId));

  for (const participant of nextParticipants) {
    if (!existingParticipantIds.has(participant.profileId)) {
      await publishActivityEvent({
        supabase: serviceClient,
        orgId,
        eventType: 'member.joined',
        occurredAt: now,
        sourceKind: 'profile',
        actorProfileId,
        scope: { kind: 'learning_space', learningSpaceId },
        targetRef: { kind: 'learning_space', id: learningSpaceId },
        payload: {
          learningSpaceId,
          channelId,
          memberProfileId: participant.profileId,
          memberDisplayName: participant.displayName ?? null,
          role: participant.kind,
        },
        dedupeKey: `member.joined:${learningSpaceId}:${participant.profileId}:${now}`,
        createdBy: actorProfileId,
      });
    }
  }

  for (const removedProfileId of existingParticipantIds) {
    if (nextParticipantIds.has(removedProfileId)) {
      continue;
    }
    await publishActivityEvent({
      supabase: serviceClient,
      orgId,
      eventType: 'member.removed',
      occurredAt: now,
      sourceKind: 'profile',
      actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId },
      targetRef: { kind: 'learning_space', id: learningSpaceId },
      payload: {
        learningSpaceId,
        channelId,
        memberProfileId: removedProfileId,
      },
      dedupeKey: `member.removed:${learningSpaceId}:${removedProfileId}:${now}`,
      createdBy: actorProfileId,
    });
  }

  const previousSchedules = existingSchedulesResponse.data ?? [];
  if (!previousSchedules.length && payload.schedules?.length) {
    for (const schedule of payload.schedules) {
      const expanded = buildScheduleStartForActivity(schedule);
      await publishActivityEvent({
        supabase: serviceClient,
        orgId,
        eventType: 'session.scheduled',
        occurredAt: now,
        sourceKind: 'profile',
        actorProfileId,
        scope: { kind: 'learning_space', learningSpaceId },
        targetRef: { kind: 'learning_space', id: learningSpaceId },
        payload: {
          learningSpaceId,
          channelId,
          scheduleId: 'pending',
          title: payload.basics.title,
          startAt: expanded.startAt,
          endAt: expanded.endAt,
        },
        dedupeKey: `session.scheduled:${learningSpaceId}:${expanded.startAt}`,
        createdBy: actorProfileId,
      });
    }
  } else if (previousSchedules.length && !(payload.schedules?.length)) {
    for (const schedule of previousSchedules) {
      await publishActivityEvent({
        supabase: serviceClient,
        orgId,
        eventType: 'session.canceled',
        occurredAt: now,
        sourceKind: 'profile',
        actorProfileId,
        scope: { kind: 'learning_space', learningSpaceId },
        targetRef: { kind: 'learning_space', id: learningSpaceId },
        payload: {
          learningSpaceId,
          channelId,
          scheduleId: schedule.id,
          title: schedule.title,
          startAt: schedule.start_at,
          endAt: schedule.end_at,
        },
        dedupeKey: `session.canceled:${schedule.id}:${now}`,
        createdBy: actorProfileId,
      });
    }
  } else if (previousSchedules.length && payload.schedules?.length) {
    for (const schedule of payload.schedules) {
      const expanded = buildScheduleStartForActivity(schedule);
      await publishActivityEvent({
        supabase: serviceClient,
        orgId,
        eventType: 'session.rescheduled',
        occurredAt: now,
        sourceKind: 'profile',
        actorProfileId,
        scope: { kind: 'learning_space', learningSpaceId },
        targetRef: { kind: 'learning_space', id: learningSpaceId },
        payload: {
          learningSpaceId,
          channelId,
          scheduleId: previousSchedules[0]?.id ?? 'pending',
          title: payload.basics.title,
          startAt: expanded.startAt,
          endAt: expanded.endAt,
        },
        dedupeKey: `session.rescheduled:${learningSpaceId}:${expanded.startAt}:${now}`,
        createdBy: actorProfileId,
      });
    }
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
    supabase
      .from('class_schedules')
      .delete()
      .eq('org_id', orgId)
      .in('id', scheduleIds),
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
