import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChannelRow,
  ChannelMemberRow,
  ChannelCapabilityRow,
  ChannelReadStateRow,
} from '@iconicedu/shared-types';

import {
  CHANNEL_SELECT,
  CHANNEL_MEMBER_SELECT,
  CHANNEL_CAPABILITY_SELECT,
  CHANNEL_READ_STATE_SELECT,
} from '@iconicedu/web/lib/channels/constants/selects';

export async function getChannelsByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('channels')
    .select(CHANNEL_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<ChannelRow[]>();
}

export async function getChannelById(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from('channels')
    .select(CHANNEL_SELECT)
    .eq('org_id', orgId)
    .eq('id', channelId)
    .is('deleted_at', null)
    .maybeSingle<ChannelRow>();
}

export async function getChannelByDmKey(
  supabase: SupabaseClient,
  orgId: string,
  dmKey: string,
) {
  return supabase
    .from('channels')
    .select(CHANNEL_SELECT)
    .eq('org_id', orgId)
    .eq('dm_key', dmKey)
    .is('deleted_at', null)
    .maybeSingle<ChannelRow>();
}

export async function getChannelParticipantsByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as ChannelMemberRow[] };
  }

  return supabase
    .from('channel_members')
    .select(CHANNEL_MEMBER_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .returns<ChannelMemberRow[]>();
}

export async function getChannelCapabilitiesByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as ChannelCapabilityRow[] };
  }

  return supabase
    .from('channel_capabilities')
    .select(CHANNEL_CAPABILITY_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .returns<ChannelCapabilityRow[]>();
}

export async function getChannelReadStatesByAccountId(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
) {
  return supabase
    .from('channel_read_state')
    .select(CHANNEL_READ_STATE_SELECT)
    .eq('org_id', orgId)
    .eq('account_id', accountId)
    .returns<ChannelReadStateRow[]>();
}
