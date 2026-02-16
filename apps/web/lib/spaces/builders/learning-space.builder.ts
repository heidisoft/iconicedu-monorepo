import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChannelVM,
  ClassScheduleVM,
  LearningSpaceLinkVM,
  LearningSpaceVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type {
  LearningSpaceRow,
  LearningSpaceChannelRow,
  LearningSpaceLinkRow,
  LearningSpaceParticipantRow,
} from '@iconicedu/shared-types';

import {
  getLearningSpaceById,
  getLearningSpacesByOrg,
} from '@iconicedu/web/lib/spaces/queries/learning-spaces.query';
import {
  getLearningSpaceChannelsByLearningSpaceIds,
  getLearningSpaceChannelByChannelId,
  getLearningSpaceLinksByLearningSpaceIds,
  getLearningSpaceParticipantsByLearningSpaceIds,
} from '@iconicedu/web/lib/spaces/queries/learning-space-relations.query';
import { mapLearningSpaceLinkRow, mapLearningSpaceRowToVM } from '@iconicedu/web/lib/spaces/mappers/learning-space.mapper';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { buildClassScheduleById } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';

type LearningSpaceRelations = {
  channels: LearningSpaceChannelRow[];
  participants: LearningSpaceParticipantRow[];
  links: LearningSpaceLinkRow[];
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
    (primaryRow &&
      (await buildChannelById(supabase, orgId, primaryRow.channel_id, {
        accountId: options.accountId ?? undefined,
      }))) ??
    channels[0] ??
    null;

  const relatedChannels = primaryChannel
    ? channels.filter((channel) => channel.ids.id !== primaryChannel.ids.id)
    : channels;

  return { primaryChannel, relatedChannels };
}

async function resolveParticipants(
  supabase: SupabaseClient,
  rows: LearningSpaceParticipantRow[],
): Promise<UserProfileVM[]> {
  const profiles = await Promise.all(
    rows.map((row) => buildUserProfileById(supabase, row.profile_id)),
  );
  return profiles.filter((profile): profile is UserProfileVM => Boolean(profile));
}

function resolveLinks(rows: LearningSpaceLinkRow[]): LearningSpaceLinkVM[] {
  return rows.map(mapLearningSpaceLinkRow);
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

  const [participants, links] = await Promise.all([
    resolveParticipants(supabase, relations.participants),
    Promise.resolve(resolveLinks(relations.links)),
  ]);

  const scheduleSeries = await resolveSchedule(supabase, row.org_id, scheduleId);

  return mapLearningSpaceRowToVM(row, {
    channels: {
      primaryChannel,
      relatedChannels: relatedChannels.length ? relatedChannels : undefined,
    },
    participants,
    links: links.length ? links : undefined,
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
  const { data: learningSpace } = await getLearningSpaceById(
    supabase,
    learningSpaceId,
  );

  if (!learningSpace || learningSpace.org_id !== orgId) {
    return null;
  }

  const [channels, participants, links] = await Promise.all([
    getLearningSpaceChannelsByLearningSpaceIds(supabase, orgId, [learningSpaceId]),
    getLearningSpaceParticipantsByLearningSpaceIds(supabase, orgId, [learningSpaceId]),
    getLearningSpaceLinksByLearningSpaceIds(supabase, orgId, [learningSpaceId]),
  ]);

  return buildLearningSpaceFromRow(
    supabase,
    learningSpace,
    {
      channels: channels.data ?? [],
      participants: participants.data ?? [],
      links: links.data ?? [],
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

  const [channels, participants, links] = await Promise.all([
    getLearningSpaceChannelsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
    getLearningSpaceParticipantsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
    getLearningSpaceLinksByLearningSpaceIds(supabase, orgId, learningSpaceIds),
  ]);

  const channelsBySpace = groupBy(channels.data ?? [], (row) => row.learning_space_id);
  const participantsBySpace = groupBy(
    participants.data ?? [],
    (row) => row.learning_space_id,
  );
  const linksBySpace = groupBy(links.data ?? [], (row) => row.learning_space_id);

  const results = await Promise.all(
    learningSpaces.map((space) =>
      buildLearningSpaceFromRow(
        supabase,
        space,
        {
          channels: channelsBySpace.get(space.id) ?? [],
          participants: participantsBySpace.get(space.id) ?? [],
          links: linksBySpace.get(space.id) ?? [],
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

function groupBy<T, K extends string>(
  rows: T[],
  getKey: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}
