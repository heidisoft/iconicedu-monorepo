import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getChannelByDmKey } from '@iconicedu/web/lib/channels/queries/channels.query';

export async function ensureDirectMessageChannel(
  supabase: SupabaseClient,
  orgId: string,
  currentProfileId: string,
  otherProfileId: string,
) {
  const dmKey = `dm:${[currentProfileId, otherProfileId].sort().join('-')}`;
  const existing = await getChannelByDmKey(supabase, orgId, dmKey);

  if (existing.data) {
    return { channelId: existing.data.id, dmKey };
  }

  const now = new Date().toISOString();
  const channelId = randomUUID();

  const { error: channelError } = await supabase.from('channels').insert({
    id: channelId,
    org_id: orgId,
    kind: 'dm',
    topic: 'Direct message',
    description: null,
    icon_key: null,
    visibility: 'private',
    purpose: 'general',
    status: 'active',
    dm_key: dmKey,
    posting_policy_kind: 'members-only',
    allow_threads: true,
    allow_reactions: true,
    created_by_profile_id: currentProfileId,
    created_at: now,
    created_by: currentProfileId,
    updated_at: now,
    updated_by: currentProfileId,
  });

  if (channelError) {
    throw new Error(channelError.message);
  }

  const memberIds = Array.from(new Set([currentProfileId, otherProfileId]));
  const memberRows = memberIds.map((profileId) => ({
    id: randomUUID(),
    org_id: orgId,
    channel_id: channelId,
    profile_id: profileId,
    joined_at: now,
    role_in_channel: null,
    created_at: now,
    created_by: currentProfileId,
    updated_at: now,
    updated_by: currentProfileId,
  }));

  const { error: memberError } = await supabase
    .from('channel_members')
    .insert(memberRows);
  if (memberError) {
    throw new Error(memberError.message);
  }

  return { channelId, dmKey };
}
