import type {
  ChannelCapabilityVM,
  ChannelPostingPolicyVM,
  ThemeKey,
  UserProfileVM,
} from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import {
  getChannelById,
  getChannelCapabilitiesByChannelIds,
  getChannelParticipantsByChannelIds,
} from '@iconicedu/web/lib/channels/queries/channels.query';

export type ChannelDetail = {
  ids: { id: string; orgId: string };
  basics: {
    kind: string;
    topic: string;
    iconKey: string | null;
    description: string | null;
    visibility: string;
    purpose: string;
  };
  ui: {
    themeKey: ThemeKey | null;
  };
  postingPolicy: ChannelPostingPolicyVM;
  lifecycle: {
    status: 'active' | 'archived';
  };
  participants: UserProfileVM[];
  capabilities: ChannelCapabilityVM[];
};

export async function getChannelDetail(channelId: string): Promise<ChannelDetail> {
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

  const orgId = accountResponse.data.org_id;
  const channelResponse = await getChannelById(supabase, orgId, channelId);

  if (channelResponse.error) {
    throw new Error(channelResponse.error.message);
  }

  if (!channelResponse.data) {
    throw new Error('Channel not found');
  }

  const [membersResponse, capabilitiesResponse] = await Promise.all([
    getChannelParticipantsByChannelIds(supabase, orgId, [channelId]),
    getChannelCapabilitiesByChannelIds(supabase, orgId, [channelId]),
  ]);

  if ('error' in membersResponse && membersResponse.error) {
    throw new Error(membersResponse.error.message);
  }
  if ('error' in capabilitiesResponse && capabilitiesResponse.error) {
    throw new Error(capabilitiesResponse.error.message);
  }

  const participantProfiles = await Promise.all(
    (membersResponse.data ?? []).map((row) =>
      buildUserProfileById(supabase, row.profile_id),
    ),
  );
  const participants = participantProfiles.filter(
    (profile): profile is UserProfileVM => Boolean(profile),
  );

  const capabilities = (capabilitiesResponse.data ?? [])
    .map((row) => row.capability)
    .filter(Boolean) as ChannelCapabilityVM[];

  return {
    ids: { id: channelResponse.data.id, orgId },
    basics: {
      kind: channelResponse.data.kind,
      topic: channelResponse.data.topic,
      iconKey: channelResponse.data.icon_key ?? null,
      description: channelResponse.data.description ?? null,
      visibility: channelResponse.data.visibility,
      purpose: channelResponse.data.purpose,
    },
    ui: {
      themeKey: (channelResponse.data.ui_theme_key ?? null) as ThemeKey | null,
    },
    postingPolicy: {
      kind: (channelResponse.data.posting_policy_kind ??
        'members-only') as ChannelPostingPolicyVM['kind'],
      allowThreads: channelResponse.data.allow_threads ?? true,
      allowReactions: channelResponse.data.allow_reactions ?? true,
    },
    lifecycle: {
      status: channelResponse.data.status === 'archived' ? 'archived' : 'active',
    },
    participants,
    capabilities,
  } satisfies ChannelDetail;
}
