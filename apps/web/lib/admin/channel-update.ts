import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import type { ChannelCreatePayload, ChannelCapabilityVM } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { toStoredLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';
import { defaultMessageUiThemeKeyForChannelKind } from '@iconicedu/web/lib/channels/ui-defaults';

export async function updateChannelFromPayload(
  channelId: string,
  payload: ChannelCreatePayload,
  actorContext?: {
    orgId: string;
    actorProfileId: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  const authContext = actorContext
    ? {
        orgId: actorContext.orgId,
        profileId: actorContext.actorProfileId,
      }
    : await requireAdminAuthContext();

  const orgId = authContext.orgId;
  const profileId = authContext.profileId;
  const now = new Date().toISOString();
  const { data: existingChannel, error: existingChannelError } = await supabase
    .from('channels')
    .select(
      'topic, description, icon_key, visibility, purpose, kind, ui_theme_key, ui_defaults, live_session_config, status, posting_policy_kind, allow_threads, allow_reactions',
    )
    .eq('org_id', orgId)
    .eq('id', channelId)
    .is('deleted_at', null)
    .maybeSingle<{
      topic?: string | null;
      description?: string | null;
      icon_key?: string | null;
      visibility?: string | null;
      purpose?: string | null;
      kind?: string | null;
      ui_theme_key?: string | null;
      ui_defaults?: unknown;
      live_session_config?: unknown;
      status?: string | null;
      posting_policy_kind?: string | null;
      allow_threads?: boolean | null;
      allow_reactions?: boolean | null;
    }>();

  if (existingChannelError) {
    throw new Error(existingChannelError.message);
  }

  if (!existingChannel) {
    throw new Error('Channel not found');
  }

  const [existingMembersResponse, existingCapabilitiesResponse] = await Promise.all([
    supabase
      .from('channel_members')
      .select('profile_id')
      .eq('org_id', orgId)
      .eq('channel_id', channelId)
      .returns<Array<{ profile_id: string }>>(),
    supabase
      .from('channel_capabilities')
      .select('capability')
      .eq('org_id', orgId)
      .eq('channel_id', channelId)
      .returns<Array<{ capability: ChannelCapabilityVM }>>(),
  ]);

  if (existingMembersResponse.error) {
    throw new Error(existingMembersResponse.error.message);
  }
  if (existingCapabilitiesResponse.error) {
    throw new Error(existingCapabilitiesResponse.error.message);
  }

  const nextParticipantIds = [
    ...new Set(payload.participants.map((participant) => participant.profileId)),
  ].sort();
  const existingParticipantIds = [
    ...new Set((existingMembersResponse.data ?? []).map((row) => row.profile_id)),
  ].sort();
  const nextCapabilities = [...new Set(payload.capabilities ?? [])].sort();
  const existingCapabilities = [
    ...new Set((existingCapabilitiesResponse.data ?? []).map((row) => row.capability)),
  ].sort();
  const messageUiThemeKey =
    payload.ui?.messageUiThemeKey ??
    defaultMessageUiThemeKeyForChannelKind(payload.basics.kind);
  const uiDefaults = {
    ...(payload.ui ?? {}),
    messageUiThemeKey,
  };

  const changeSummaryParts: string[] = [];
  if ((existingChannel.topic ?? null) !== payload.basics.topic) {
    changeSummaryParts.push(`Renamed channel to ${payload.basics.topic}`);
  }
  if ((existingChannel.description ?? null) !== (payload.basics.description ?? null)) {
    changeSummaryParts.push(
      payload.basics.description
        ? 'Updated channel description'
        : 'Removed channel description',
    );
  }
  if ((existingChannel.icon_key ?? null) !== (payload.basics.iconKey ?? null)) {
    changeSummaryParts.push(
      payload.basics.iconKey ? 'Updated channel icon' : 'Removed channel icon',
    );
  }
  if ((existingChannel.visibility ?? null) !== payload.basics.visibility) {
    changeSummaryParts.push(`Changed visibility to ${payload.basics.visibility}`);
  }
  if ((existingChannel.purpose ?? null) !== payload.basics.purpose) {
    changeSummaryParts.push(`Changed purpose to ${payload.basics.purpose}`);
  }
  if ((existingChannel.kind ?? null) !== payload.basics.kind) {
    changeSummaryParts.push('Changed channel kind');
  }
  if ((existingChannel.ui_theme_key ?? null) !== (payload.ui?.themeKey ?? 'teal')) {
    changeSummaryParts.push('Updated channel theme');
  }
  if (
    JSON.stringify(existingChannel.ui_defaults ?? null) !== JSON.stringify(uiDefaults)
  ) {
    changeSummaryParts.push('Updated channel defaults');
  }
  if (
    JSON.stringify(existingChannel.live_session_config ?? null) !==
    JSON.stringify(toStoredLiveSessionConfig(payload.liveSession))
  ) {
    changeSummaryParts.push('Updated live session settings');
  }
  if ((existingChannel.status ?? null) !== (payload.lifecycle?.status ?? 'active')) {
    changeSummaryParts.push(`Changed status to ${payload.lifecycle?.status ?? 'active'}`);
  }
  if ((existingChannel.posting_policy_kind ?? null) !== payload.postingPolicy.kind) {
    changeSummaryParts.push('Updated posting policy');
  }
  if (
    (existingChannel.allow_threads ?? true) !==
    (payload.postingPolicy.allowThreads ?? true)
  ) {
    changeSummaryParts.push(
      payload.postingPolicy.allowThreads === false
        ? 'Disabled threads'
        : 'Enabled threads',
    );
  }
  if (
    (existingChannel.allow_reactions ?? true) !==
    (payload.postingPolicy.allowReactions ?? true)
  ) {
    changeSummaryParts.push(
      payload.postingPolicy.allowReactions === false
        ? 'Disabled reactions'
        : 'Enabled reactions',
    );
  }
  if (JSON.stringify(existingParticipantIds) !== JSON.stringify(nextParticipantIds)) {
    changeSummaryParts.push('Updated channel members');
  }
  if (JSON.stringify(existingCapabilities) !== JSON.stringify(nextCapabilities)) {
    changeSummaryParts.push('Updated channel capabilities');
  }

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
    uiDefaults,
    liveSessionConfig: payload.liveSession ?? null,
    status: payload.lifecycle?.status ?? 'active',
    postingPolicyKind: payload.postingPolicy.kind,
    allowThreads: payload.postingPolicy.allowThreads ?? true,
    allowReactions: payload.postingPolicy.allowReactions ?? true,
    updatedBy: profileId,
    updatedAt: now,
  });

  await replaceChannelMembers(supabase, {
    orgId,
    channelId,
    createdBy: profileId,
    createdAt: now,
    participants: payload.participants ?? [],
  });

  await replaceChannelCapabilities(supabase, {
    orgId,
    channelId,
    createdBy: profileId,
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
