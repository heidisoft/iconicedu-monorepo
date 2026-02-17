import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { insertClassSchedules } from '@iconicedu/web/lib/admin/learning-space-create';
import type {
  LearningSpaceCreatePayload,
  LearningSpaceParticipantPayload,
  LearningSpaceResourcePayload,
} from '@iconicedu/shared-types';

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
    participants: payload.participants,
    schedules: payload.schedules ?? [],
  });
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
  participants: LearningSpaceParticipantPayload[];
  schedules: LearningSpaceCreatePayload['schedules'];
};

async function replaceLearningSpaceSchedules(
  supabase: SupabaseClient,
  payload: ReplaceSchedulesPayload,
) {
  const { data: schedules, error } = await supabase
    .from('class_schedules')
    .select('id')
    .eq('org_id', payload.orgId)
    .eq('source_learning_space_id', payload.learningSpaceId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }

  const scheduleIds = (schedules ?? []).map((row) => row.id).filter(Boolean);
  await deleteSchedules(supabase, payload.orgId, scheduleIds);

  if (!payload.schedules?.length) {
    return;
  }

  await insertClassSchedules(supabase, {
    orgId: payload.orgId,
    learningSpaceId: payload.learningSpaceId,
    channelId: payload.channelId,
    createdBy: payload.createdBy,
    createdAt: payload.createdAt,
    title: payload.title,
    description: payload.description,
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
