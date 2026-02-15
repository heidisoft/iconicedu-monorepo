import { describe, expect, it, vi } from 'vitest';

import { persistDirectMessageUnreadCount } from '@iconicedu/web/lib/sidebar/direct-message-unread-persistence';

describe('persistDirectMessageUnreadCount', () => {
  it('upserts unread count with channel/account scope', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as any;

    await persistDirectMessageUnreadCount(supabase, {
      orgId: 'org-1',
      accountId: 'account-1',
      channelId: 'dm-1',
      unreadCount: 3,
    });

    expect(from).toHaveBeenCalledWith('channel_read_state');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        account_id: 'account-1',
        channel_id: 'dm-1',
        unread_count: 3,
      }),
      { onConflict: 'org_id,channel_id,account_id' },
    );
  });

  it('clamps negative unread counts and sets last_read_at when marking read', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as any;

    await persistDirectMessageUnreadCount(supabase, {
      orgId: 'org-1',
      accountId: 'account-1',
      channelId: 'dm-1',
      unreadCount: -5,
      markRead: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        unread_count: 0,
        last_read_at: expect.any(String),
      }),
      { onConflict: 'org_id,channel_id,account_id' },
    );
  });

  it('persists last_read_message_id and explicit last_read_at when provided', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ upsert }));
    const supabase = { from } as any;

    await persistDirectMessageUnreadCount(supabase, {
      orgId: 'org-1',
      accountId: 'account-1',
      channelId: 'dm-1',
      unreadCount: 0,
      markRead: true,
      lastReadMessageId: 'message-99',
      lastReadAt: '2026-02-15T00:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        last_read_message_id: 'message-99',
        last_read_at: '2026-02-15T00:00:00.000Z',
      }),
      { onConflict: 'org_id,channel_id,account_id' },
    );
  });
});
