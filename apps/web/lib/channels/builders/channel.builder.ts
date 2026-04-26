import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';
import type { ChannelRow, ChannelMemberRow } from '@iconicedu/shared-types';

import {
  createDefaultChannelReadState,
  mapChannelCapabilityRow,
  mapChannelReadStateRow,
  mapChannelRowToVM,
} from '@iconicedu/web/lib/channels/mappers/channel.mapper';
import {
  getChannelByDmKey,
  getChannelById,
  getChannelCapabilitiesByChannelIds,
  getChannelParticipantsByChannelIds,
  getChannelReadStatesByAccountId,
  getChannelsByOrg,
} from '@iconicedu/web/lib/channels/queries/channels.query';
import {
  buildChannelFiles,
  buildChannelMedia,
  buildChannelMessages,
} from '@iconicedu/web/lib/messages/builders/channel-messages.builder';
import { buildThreadsByChannelId } from '@iconicedu/web/lib/messages/builders/thread.builder';
import { buildUserProfileFromRow } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

type BuildChannelOptions = {
  accountId?: string | null;
  profileId?: string | null;
  messagesLimit?: number;
};

export async function buildLearningSpaceChannelsWithMessages(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM[]> {
  return buildChannelsByFilter(
    supabase,
    orgId,
    options,
    (row) => row.purpose === 'learning-space',
  );
}

export async function buildDirectMessageChannelsWithMessages(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM[]> {
  const channels = await buildChannelsByFilter(
    supabase,
    orgId,
    options,
    (row) => row.kind === 'dm' || row.kind === 'group_dm',
  );

  if (!options.accountId) {
    return channels;
  }

  return channels.filter((channel) =>
    channel.collections.participants.some(
      (participant) => participant.ids.accountId === options.accountId,
    ),
  );
}

export async function buildSupportChannel(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM | null> {
  return buildChannelById(supabase, orgId, channelId, options);
}

export async function buildChannelById(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM | null> {
  const channelResponse = await getChannelById(supabase, orgId, channelId);
  if (!channelResponse.data) {
    return null;
  }

  return buildChannelFromRow(supabase, orgId, channelResponse.data, options);
}

export async function buildChannelByDmKey(
  supabase: SupabaseClient,
  orgId: string,
  dmKey: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM | null> {
  const channelResponse = await getChannelByDmKey(supabase, orgId, dmKey);
  if (!channelResponse.data) {
    return null;
  }

  return buildChannelFromRow(supabase, orgId, channelResponse.data, options);
}

export async function buildAllChannels(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildChannelOptions = {},
): Promise<ChannelVM[]> {
  return buildChannelsByFilter(supabase, orgId, options);
}

async function buildChannelsByFilter(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildChannelOptions,
  predicate?: (row: ChannelRow) => boolean,
): Promise<ChannelVM[]> {
  const response = await getChannelsByOrg(supabase, orgId);
  const rows = response.data ?? [];
  const filtered = predicate ? rows.filter(predicate) : rows;

  if (!filtered.length) {
    return [];
  }

  return buildChannelsFromRows(supabase, orgId, filtered, options);
}

async function buildChannelsFromRows(
  supabase: SupabaseClient,
  orgId: string,
  rows: ChannelRow[],
  options: BuildChannelOptions,
): Promise<ChannelVM[]> {
  const channelIds = rows.map((row) => row.id);
  const [membersResponse, capabilitiesResponse, readStatesResponse] = await Promise.all([
    getChannelParticipantsByChannelIds(supabase, orgId, channelIds),
    getChannelCapabilitiesByChannelIds(supabase, orgId, channelIds),
    options.accountId
      ? getChannelReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
  ]);

  const membersByChannel = groupBy(membersResponse.data ?? [], (row) => row.channel_id);
  const capabilitiesByChannel = groupBy(
    capabilitiesResponse.data ?? [],
    (row) => row.channel_id,
  );
  const readStateByChannel = new Map(
    (readStatesResponse.data ?? []).map((row) => [
      row.channel_id,
      mapChannelReadStateRow(row),
    ]),
  );

  const participantsByChannel = await loadParticipantsByChannel(
    supabase,
    orgId,
    membersByChannel,
  );

  const results = await Promise.all(
    rows.map(async (row) => {
      const threads = await buildThreadsByChannelId(supabase, orgId, row.id, {
        accountId: options.accountId ?? undefined,
      });
      const threadsById = new Map(threads.map((thread) => [thread.ids.id, thread]));
      const threadUnreadCount = threads.reduce(
        (total, thread) => total + Math.max(0, thread.readState?.unreadCount ?? 0),
        0,
      );
      const messages = await buildChannelMessages(supabase, orgId, row.id, {
        threadsById,
        limit: options.messagesLimit,
        profileId: options.profileId ?? undefined,
      });
      const [media, files] = await Promise.all([
        buildChannelMedia(supabase, orgId, row.id),
        buildChannelFiles(supabase, orgId, row.id),
      ]);
      const capabilities = (capabilitiesByChannel.get(row.id) ?? []).map(
        mapChannelCapabilityRow,
      );

      return mapChannelRowToVM(row, {
        participants: participantsByChannel.get(row.id) ?? [],
        messages,
        media,
        files,
        capabilities: capabilities.length ? capabilities : undefined,
        readState: {
          ...(readStateByChannel.get(row.id) ?? createDefaultChannelReadState(row.id)),
          threadUnreadCount,
        },
      });
    }),
  );

  return results;
}

async function buildChannelFromRow(
  supabase: SupabaseClient,
  orgId: string,
  row: ChannelRow,
  options: BuildChannelOptions,
): Promise<ChannelVM> {
  const [membersResponse, capabilitiesResponse, readStatesResponse] = await Promise.all([
    getChannelParticipantsByChannelIds(supabase, orgId, [row.id]),
    getChannelCapabilitiesByChannelIds(supabase, orgId, [row.id]),
    options.accountId
      ? getChannelReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
  ]);

  const participants = await loadParticipants(
    supabase,
    orgId,
    membersResponse.data ?? [],
  );
  const threads = await buildThreadsByChannelId(supabase, orgId, row.id, {
    accountId: options.accountId ?? undefined,
  });
  const threadsById = new Map(threads.map((thread) => [thread.ids.id, thread]));
  const threadUnreadCount = threads.reduce(
    (total, thread) => total + Math.max(0, thread.readState?.unreadCount ?? 0),
    0,
  );
  const messages = await buildChannelMessages(supabase, orgId, row.id, {
    threadsById,
    limit: options.messagesLimit,
    profileId: options.profileId ?? undefined,
  });
  const [media, files] = await Promise.all([
    buildChannelMedia(supabase, orgId, row.id),
    buildChannelFiles(supabase, orgId, row.id),
  ]);
  const capabilities = (capabilitiesResponse.data ?? []).map(mapChannelCapabilityRow);
  const readStateRow = (readStatesResponse.data ?? []).find(
    (readState) => readState.channel_id === row.id,
  );

  return mapChannelRowToVM(row, {
    participants,
    messages,
    media,
    files,
    capabilities: capabilities.length ? capabilities : undefined,
    readState: readStateRow
      ? { ...mapChannelReadStateRow(readStateRow), threadUnreadCount }
      : { ...createDefaultChannelReadState(row.id), threadUnreadCount },
  });
}

async function loadParticipantsByChannel(
  supabase: SupabaseClient,
  orgId: string,
  membersByChannel: Map<string, ChannelMemberRow[]>,
): Promise<Map<string, UserProfileVM[]>> {
  const profileIds = Array.from(
    new Set(
      Array.from(membersByChannel.values())
        .flat()
        .map((row) => row.profile_id),
    ),
  );

  const profilesResponse = await getProfilesByIds(supabase, orgId, profileIds);
  const profileRows = profilesResponse.data ?? [];

  const profileVMs: Array<[string, UserProfileVM]> = await Promise.all(
    profileRows.map(
      async (row) =>
        [row.id, await buildUserProfileFromRow(supabase, row)] as [string, UserProfileVM],
    ),
  );
  const profileVMMap = new Map(profileVMs);

  const participantsByChannel = new Map<string, UserProfileVM[]>();
  membersByChannel.forEach((rows, channelId) => {
    const participants = rows
      .map((member) => profileVMMap.get(member.profile_id))
      .filter((profile): profile is UserProfileVM => Boolean(profile));
    participantsByChannel.set(channelId, participants);
  });

  return participantsByChannel;
}

async function loadParticipants(
  supabase: SupabaseClient,
  orgId: string,
  members: ChannelMemberRow[],
): Promise<UserProfileVM[]> {
  if (!members.length) {
    return [];
  }

  const profileIds = Array.from(new Set(members.map((row) => row.profile_id)));
  const profilesResponse = await getProfilesByIds(supabase, orgId, profileIds);
  const profileRows = profilesResponse.data ?? [];
  const profileVMs = await Promise.all(
    profileRows.map((row) => buildUserProfileFromRow(supabase, row)),
  );

  const profileVMMap = new Map(
    profileRows.map((row, index) => [row.id, profileVMs[index]]),
  );

  return members
    .map((member) => profileVMMap.get(member.profile_id))
    .filter((profile): profile is UserProfileVM => Boolean(profile));
}

function groupBy<T, K extends string>(rows: T[], getKey: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}
