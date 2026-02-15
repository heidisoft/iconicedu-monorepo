import { describe, expect, it } from 'vitest';

import { mapMessageRowToVM } from '@iconicedu/web/lib/messages/mappers/message.mapper';

describe('mapMessageRowToVM', () => {
  const row = {
    id: 'message-1',
    org_id: 'org-1',
    type: 'text',
    sender_profile_id: 'profile-1',
    visibility_type: 'all',
    visibility_user_id: null,
    visibility_user_ids: null,
    is_edited: null,
    is_saved: null,
    is_hidden: null,
    edited_at: null,
    created_at: '2026-01-01T10:00:00.000Z',
  } as const;

  const sender = {
    ids: { id: 'profile-1', orgId: 'org-1' },
  };

  it('does not include social.thread when thread input is missing', () => {
    const message = mapMessageRowToVM(row as never, {
      sender: sender as never,
      payload: { text: 'Hello' },
    });

    expect('thread' in message.social).toBe(false);
  });

  it('includes social.thread when thread input exists', () => {
    const message = mapMessageRowToVM(row as never, {
      sender: sender as never,
      payload: { text: 'Hello' },
      thread: { ids: { id: 'thread-1', orgId: 'org-1' } } as never,
    });

    expect(message.social.thread?.ids.id).toBe('thread-1');
  });
});

