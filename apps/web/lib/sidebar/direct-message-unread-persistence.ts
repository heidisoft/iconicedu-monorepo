import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISODateTime, UUID } from '@iconicedu/shared-types';

type PersistDirectMessageUnreadInput = {
  orgId: UUID;
  accountId: UUID;
  channelId: UUID;
  unreadCount: number;
  markRead?: boolean;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
};

export async function persistDirectMessageUnreadCount(
  supabase: SupabaseClient,
  input: PersistDirectMessageUnreadInput,
) {
  const unreadCount = Math.max(0, input.unreadCount);
  const payload: {
    org_id: UUID;
    account_id: UUID;
    channel_id: UUID;
    unread_count: number;
    last_read_message_id?: UUID | null;
    last_read_at?: ISODateTime | null;
  } = {
    org_id: input.orgId,
    account_id: input.accountId,
    channel_id: input.channelId,
    unread_count: unreadCount,
  };

  if (input.lastReadMessageId) {
    payload.last_read_message_id = input.lastReadMessageId;
  }

  if (input.markRead) {
    payload.last_read_at = input.lastReadAt ?? new Date().toISOString();
  } else if (input.lastReadAt) {
    payload.last_read_at = input.lastReadAt;
  }

  return supabase.from('channel_read_state').upsert(
    payload,
    {
      onConflict: 'org_id,channel_id,account_id',
    },
  );
}
