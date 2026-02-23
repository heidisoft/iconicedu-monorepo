import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChannelCreatePayload, ChannelCapabilityVM } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';

const DEFAULT_CAPABILITIES: ChannelCapabilityVM[] = [];

export async function createAdminChannel(payload: ChannelCreatePayload) {
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

  const now = new Date().toISOString();
  const channelId = randomUUID();
  const status = payload.lifecycle?.status ?? 'active';

  const { error } = await supabase.from('channels').insert({
    id: channelId,
    org_id: accountResponse.data.org_id,
    kind: payload.basics.kind,
    topic: payload.basics.topic.trim(),
    description: payload.basics.description ?? null,
    icon_key: payload.basics.iconKey ?? null,
    visibility: payload.basics.visibility,
    purpose: payload.basics.purpose,
    ui_theme_key: payload.ui?.themeKey ?? 'teal',
    ui_defaults: payload.ui ?? null,
    status,
    posting_policy_kind: payload.postingPolicy.kind,
    allow_threads: payload.postingPolicy.allowThreads ?? true,
    allow_reactions: payload.postingPolicy.allowReactions ?? true,
    created_by_profile_id: profileResponse.data.id,
    created_at: now,
    created_by: profileResponse.data.id,
    updated_at: now,
    updated_by: profileResponse.data.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  await insertChannelMembers(supabase, {
    orgId: accountResponse.data.org_id,
    channelId,
    createdBy: profileResponse.data.id,
    createdAt: now,
    participants: payload.participants,
  });

  await insertChannelCapabilities(supabase, {
    orgId: accountResponse.data.org_id,
    channelId,
    createdBy: profileResponse.data.id,
    createdAt: now,
    capabilities: payload.capabilities ?? DEFAULT_CAPABILITIES,
  });

  return channelId;
}

type ChannelMembersInsertPayload = {
  orgId: string;
  channelId: string;
  participants: ChannelCreatePayload['participants'];
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
    role_in_channel: participant.roleInChannel ?? null,
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
  capabilities: ChannelCapabilityVM[];
};

async function insertChannelCapabilities(
  supabase: SupabaseClient,
  payload: ChannelCapabilitiesInsertPayload,
) {
  const uniqueCapabilities = Array.from(new Set(payload.capabilities));
  if (!uniqueCapabilities.length) {
    return;
  }

  const rows = uniqueCapabilities.map((capability) => ({
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
