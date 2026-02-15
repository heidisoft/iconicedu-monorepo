import type { SupabaseClient } from '@supabase/supabase-js';

type PersistDirectMessageUnreadInput = {
  orgId: string;
  accountId: string;
  channelId: string;
  unreadCount: number;
  markRead?: boolean;
};

export async function persistDirectMessageUnreadCount(
  supabase: SupabaseClient,
  input: PersistDirectMessageUnreadInput,
) {
  const unreadCount = Math.max(0, input.unreadCount);
  return supabase.from('channel_read_state').upsert(
    {
      org_id: input.orgId,
      account_id: input.accountId,
      channel_id: input.channelId,
      unread_count: unreadCount,
      last_read_at: input.markRead ? new Date().toISOString() : null,
    },
    {
      onConflict: 'org_id,channel_id,account_id',
    },
  );
}
