import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChannelVM,
  ClassScheduleVM,
  LearningSpaceVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type {
  LearningSpaceRow,
  LearningSpaceChannelRow,
  LearningSpaceParticipantRow,
} from '@iconicedu/shared-types';
import { groupBy } from '@iconicedu/utils';

import {
  getLearningSpaceById,
  getLearningSpacesByOrg,
} from '@iconicedu/web/lib/spaces/queries/learning-spaces.query';
import {
  getLearningSpaceChannelsByLearningSpaceIds,
  getLearningSpaceChannelByChannelId,
  getLearningSpaceParticipantsByLearningSpaceIds,
} from '@iconicedu/web/lib/spaces/queries/learning-space-relations.query';
import { mapLearningSpaceRowToVM } from '@iconicedu/web/lib/spaces/mappers/learning-space.mapper';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { buildUserProfilesByIds } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { buildClassScheduleById } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';

type LearningSpaceRelations = {
  channels: LearningSpaceChannelRow[];
  participants: LearningSpaceParticipantRow[];
};

type BuildLearningSpaceOptions = {
  accountId?: string | null;
};

async function resolveChannels(
  supabase: SupabaseClient,
  orgId: string,
  rows: LearningSpaceChannelRow[],
  options: BuildLearningSpaceOptions = {},
): Promise<{ primaryChannel: ChannelVM | null; relatedChannels: ChannelVM[] }> {
  const channels = (
    await Promise.all(
      rows.map((row) =>
        buildChannelById(supabase, orgId, row.channel_id, {
          accountId: options.accountId ?? undefined,
        }),
      ),
    )
  ).filter((channel): channel is ChannelVM => Boolean(channel));

  const primaryRow = rows.find((row) => row.is_primary);
  const primaryChannel =
    channels.find((channel) => channel.ids.id === primaryRow?.channel_id) ??
    channels[0] ??
    null;

  const relatedChannels = primaryChannel
    ? channels.filter((channel) => channel.ids.id !== primaryChannel.ids.id)
    : channels;

  return { primaryChannel, relatedChannels };
}

async function resolveParticipants(
  supabase: SupabaseClient,
  orgId: string,
  rows: LearningSpaceParticipantRow[],
): Promise<UserProfileVM[]> {
  const profilesById = await buildUserProfilesByIds(
    supabase,
    orgId,
    rows.map((row) => row.profile_id),
  );
  return rows
    .map((row) => profilesById.get(row.profile_id))
    .filter((profile): profile is UserProfileVM => Boolean(profile));
}

async function resolveSchedule(
  supabase: SupabaseClient,
  orgId: string,
  scheduleId?: string | null,
): Promise<ClassScheduleVM | null> {
  return scheduleId ? buildClassScheduleById(supabase, orgId, scheduleId) : null;
}

async function resolveNextScheduleId(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceId: string,
): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('class_schedules')
    .select('id, start_at')
    .eq('org_id', orgId)
    .eq('source_learning_space_id', learningSpaceId)
    .is('deleted_at', null)
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

export async function buildLearningSpaceFromRow(
  supabase: SupabaseClient,
  row: LearningSpaceRow,
  relations: LearningSpaceRelations,
  scheduleId?: string | null,
  options: BuildLearningSpaceOptions = {},
): Promise<LearningSpaceVM | null> {
  const { primaryChannel, relatedChannels } = await resolveChannels(
    supabase,
    row.org_id,
    relations.channels,
    options,
  );
  if (!primaryChannel) {
    return null;
  }

  const participants = await resolveParticipants(
    supabase,
    row.org_id,
    relations.participants,
  );

  const scheduleSeries = await resolveSchedule(supabase, row.org_id, scheduleId);

  return mapLearningSpaceRowToVM(row, {
    channels: {
      primaryChannel,
      relatedChannels: relatedChannels.length ? relatedChannels : undefined,
    },
    participants,
    scheduleSeries,
  });
}

export async function buildLearningSpaceById(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceId: string,
  scheduleId?: string | null,
  options: BuildLearningSpaceOptions = {},
): Promise<LearningSpaceVM | null> {
  const { data: learningSpace } = await getLearningSpaceById(supabase, learningSpaceId);

  if (!learningSpace || learningSpace.org_id !== orgId) {
    return null;
  }

  const [channels, participants] = await Promise.all([
    getLearningSpaceChannelsByLearningSpaceIds(supabase, orgId, [learningSpaceId]),
    getLearningSpaceParticipantsByLearningSpaceIds(supabase, orgId, [learningSpaceId]),
  ]);

  return buildLearningSpaceFromRow(
    supabase,
    learningSpace,
    {
      channels: channels.data ?? [],
      participants: participants.data ?? [],
    },
    scheduleId,
    options,
  );
}

export async function buildLearningSpacesByOrg(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildLearningSpaceOptions = {},
): Promise<LearningSpaceVM[]> {
  const { data: learningSpaces } = await getLearningSpacesByOrg(supabase, orgId);
  if (!learningSpaces?.length) {
    return [];
  }

  const learningSpaceIds = learningSpaces.map((space) => space.id);

  const [channels, participants] = await Promise.all([
    getLearningSpaceChannelsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
    getLearningSpaceParticipantsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
  ]);

  const channelsBySpace = groupBy(channels.data ?? [], (row) => row.learning_space_id);
  const participantsBySpace = groupBy(
    participants.data ?? [],
    (row) => row.learning_space_id,
  );

  const results = await Promise.all(
    learningSpaces.map((space) =>
      buildLearningSpaceFromRow(
        supabase,
        space,
        {
          channels: channelsBySpace.get(space.id) ?? [],
          participants: participantsBySpace.get(space.id) ?? [],
        },
        undefined,
        options,
      ),
    ),
  );

  return results.filter((space): space is LearningSpaceVM => Boolean(space));
}

export async function buildLearningSpaceByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: BuildLearningSpaceOptions = {},
): Promise<LearningSpaceVM | null> {
  const channelResponse = await getLearningSpaceChannelByChannelId(
    supabase,
    orgId,
    channelId,
  );

  const channelRow = channelResponse.data;
  if (!channelRow) {
    return null;
  }

  const scheduleId = await resolveNextScheduleId(
    supabase,
    orgId,
    channelRow.learning_space_id,
  );

  return buildLearningSpaceById(
    supabase,
    orgId,
    channelRow.learning_space_id,
    scheduleId,
    options,
  );
}
