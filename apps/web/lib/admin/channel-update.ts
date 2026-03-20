import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChannelCreatePayload, ChannelCapabilityVM } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';

export async function updateChannelFromPayload(
  channelId: string,
  payload: ChannelCreatePayload,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);

  const orgId = actor.account.org_id;
  const now = new Date().toISOString();

  await updateChannel(supabase, {
    id: channelId,
    orgId,
    topic: payload.basics.topic,
    description: payload.basics.description ?? null,
    iconKey: payload.basics.iconKey ?? null,
    visibility: payload.basics.visibility,
    purpose: payload.basics.purpose,
    kind: payload.basics.kind,
    themeKey: payload.ui?.themeKey ?? 'teal',
    uiDefaults: payload.ui ?? null,
    liveSessionConfig: payload.liveSession ?? null,
    status: payload.lifecycle?.status ?? 'active',
    postingPolicyKind: payload.postingPolicy.kind,
    allowThreads: payload.postingPolicy.allowThreads ?? true,
    allowReactions: payload.postingPolicy.allowReactions ?? true,
    updatedBy: actor.profile.id,
    updatedAt: now,
  });

  await replaceChannelMembers(supabase, {
    orgId,
    channelId,
    createdBy: actor.profile.id,
    createdAt: now,
    participants: payload.participants ?? [],
  });

  await replaceChannelCapabilities(supabase, {
    orgId,
    channelId,
    createdBy: actor.profile.id,
    createdAt: now,
    capabilities: payload.capabilities ?? [],
  });
}

type UpdateChannelPayload = {
  id: string;
  orgId: string;
  topic: string;
  description: string | null;
  iconKey: string | null;
  visibility: string;
  purpose: string;
  kind: string;
  themeKey: string;
  uiDefaults: ChannelCreatePayload['ui'];
  liveSessionConfig: ChannelCreatePayload['liveSession'];
  status: string;
  postingPolicyKind: string;
  allowThreads: boolean;
  allowReactions: boolean;
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
      visibility: payload.visibility,
      purpose: payload.purpose,
      kind: payload.kind,
      ui_theme_key: payload.themeKey,
      ui_defaults: payload.uiDefaults,
      live_session_config: toStoredLiveSessionConfig(payload.liveSessionConfig),
      status: payload.status,
      posting_policy_kind: payload.postingPolicyKind,
      allow_threads: payload.allowThreads,
      allow_reactions: payload.allowReactions,
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

type ReplaceChannelMembersPayload = {
  orgId: string;
  channelId: string;
  participants: ChannelCreatePayload['participants'];
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

type ReplaceChannelCapabilitiesPayload = {
  orgId: string;
  channelId: string;
  capabilities: ChannelCapabilityVM[];
  createdBy: string;
  createdAt: string;
};

async function replaceChannelCapabilities(
  supabase: SupabaseClient,
  payload: ReplaceChannelCapabilitiesPayload,
) {
  await ensureDeleted(
    supabase
      .from('channel_capabilities')
      .delete()
      .eq('org_id', payload.orgId)
      .eq('channel_id', payload.channelId),
  );

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

async function ensureDeleted(
  request: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await request;
  if (error) {
    throw new Error(error.message);
  }
}
