import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { ChannelRow, ChannelMemberRow, UserProfileVM } from '@iconicedu/shared-types';
import {
  getChannelsByOrg,
  getChannelParticipantsByChannelIds,
} from '@iconicedu/web/lib/channels/queries/channels.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';

type ChannelParticipantDetail = {
  id: string;
  displayName: string;
  kind: UserProfileVM['kind'];
  avatarUrl: string | null;
  themeKey: string | null;
};

export type AdminChannelRow = ChannelRow & {
  participantCount: number;
  participantDetails?: ChannelParticipantDetail[];
};

function toDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}) {
  const display = input.displayName?.trim() ?? '';
  if (display) {
    return display;
  }
  const first = input.firstName?.trim() ?? '';
  const last = input.lastName?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return 'User';
}

export function filterDirectMessageChannels(rows: AdminChannelRow[]) {
  return rows.filter((row) => row.kind === 'dm' || row.kind === 'group_dm');
}

export async function getAdminChannelRows(orgId: string): Promise<AdminChannelRow[]> {
  if (!orgId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data: channels } = await getChannelsByOrg(supabase, orgId);

  if (!channels?.length) {
    return [];
  }

  const channelIds = channels.map((row) => row.id);
  const membersResponse = await getChannelParticipantsByChannelIds(
    supabase,
    orgId,
    channelIds,
  );
  const members = membersResponse.data ?? [];

  const countsByChannel = new Map<string, number>();
  const membersByChannel = new Map<string, ChannelMemberRow[]>();
  members.forEach((row: ChannelMemberRow) => {
    countsByChannel.set(row.channel_id, (countsByChannel.get(row.channel_id) ?? 0) + 1);
    const existing = membersByChannel.get(row.channel_id) ?? [];
    membersByChannel.set(row.channel_id, [...existing, row]);
  });

  const profileIds = Array.from(
    new Set(members.map((row) => row.profile_id).filter(Boolean)),
  );
  const profiles = await Promise.all(
    profileIds.map((profileId) => buildUserProfileById(supabase, profileId)),
  );
  const profileById = new Map(
    profiles.filter(Boolean).map((profile) => [profile!.ids.id, profile!]),
  );

  return channels.map((row) => {
    const participantRows = membersByChannel.get(row.id) ?? [];
    const participantDetails: ChannelParticipantDetail[] = participantRows
      .map((participant) => profileById.get(participant.profile_id))
      .filter(Boolean)
      .map((profile) => ({
        id: profile!.ids.id,
        displayName: toDisplayName({
          firstName: profile!.profile.firstName,
          lastName: profile!.profile.lastName,
          displayName: profile!.profile.displayName,
        }),
        kind: profile!.kind,
        avatarUrl: profile!.profile.avatar.url ?? null,
        themeKey: profile!.ui?.themeKey ?? null,
      }));

    return {
      ...row,
      participantCount: countsByChannel.get(row.id) ?? 0,
      participantDetails,
    };
  });
}

export async function getAdminDirectMessageRows(orgId: string): Promise<AdminChannelRow[]> {
  const rows = await getAdminChannelRows(orgId);
  return filterDirectMessageChannels(rows);
}
