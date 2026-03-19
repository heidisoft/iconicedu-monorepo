import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getChannelByDmKey } from '@iconicedu/web/lib/channels/queries/channels.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

function isChannelMemberInsertRlsError(error: { code?: string; message: string }) {
  return (
    error.code === '42501' &&
    error.message.includes('row-level security policy for table "channel_members"')
  );
}

function isDmChannelUniqueConflict(error: { code?: string; message: string }) {
  return (
    error.code === '23505' &&
    (error.message.includes('channels_org_dm_key_uniq') ||
      error.message.includes('duplicate key value'))
  );
}

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
    if (isDmChannelUniqueConflict(channelError)) {
      const concurrent = await getChannelByDmKey(supabase, orgId, dmKey);
      if (concurrent.data) {
        return { channelId: concurrent.data.id, dmKey };
      }
    }
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
    if (isChannelMemberInsertRlsError(memberError)) {
      const serviceSupabase = createSupabaseServiceClient();
      const { data: createdChannel, error: createdChannelError } = await serviceSupabase
        .from('channels')
        .select('id, org_id, kind, created_by_profile_id, deleted_at')
        .eq('id', channelId)
        .maybeSingle<{
          id: string;
          org_id: string;
          kind: string;
          created_by_profile_id: string | null;
          deleted_at: string | null;
        }>();

      if (createdChannelError) {
        throw new Error(createdChannelError.message);
      }
      if (
        !createdChannel ||
        createdChannel.org_id !== orgId ||
        createdChannel.deleted_at !== null ||
        !['dm', 'group_dm'].includes(createdChannel.kind) ||
        createdChannel.created_by_profile_id !== currentProfileId
      ) {
        throw new Error(memberError.message);
      }

      const { error: serviceMemberError } = await serviceSupabase
        .from('channel_members')
        .insert(memberRows);
      if (serviceMemberError) {
        throw new Error(serviceMemberError.message);
      }
      return { channelId, dmKey };
    }
    throw new Error(memberError.message);
  }

  return { channelId, dmKey };
}
