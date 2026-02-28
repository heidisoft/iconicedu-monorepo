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

  it('maps structured mentions from text payload', () => {
    const message = mapMessageRowToVM(row as never, {
      sender: sender as never,
      payload: {
        text: 'Hello @Taylor Reed',
        mentions: [
          { profileId: 'profile-2', displayName: 'Taylor Reed', start: 6, end: 18 },
        ],
      },
    });

    expect(message.core.type).toBe('text');
    if (message.core.type !== 'text') {
      throw new Error('Expected text message');
    }
    expect(message.content.mentions).toEqual([
      { profileId: 'profile-2', displayName: 'Taylor Reed', start: 6, end: 18 },
    ]);
  });

  it('preserves storage paths for image and audio payloads', () => {
    const imageMessage = mapMessageRowToVM(
      {
        ...row,
        id: 'message-image',
        type: 'image',
      } as never,
      {
        sender: sender as never,
        payload: {
          url: 'https://signed.example.com/image.png',
          storagePath: 'org-1/channel-1/profile-1/image.png',
          name: 'image.png',
        },
      },
    );

    const audioMessage = mapMessageRowToVM(
      {
        ...row,
        id: 'message-audio',
        type: 'audio-recording',
      } as never,
      {
        sender: sender as never,
        payload: {
          url: 'https://signed.example.com/audio.m4a',
          storagePath: 'org-1/channel-1/profile-1/audio.m4a',
          durationSeconds: 12,
        },
      },
    );

    expect(imageMessage.core.type).toBe('image');
    if (imageMessage.core.type !== 'image') {
      throw new Error('Expected image message');
    }
    expect(imageMessage.attachment.storagePath).toBe('org-1/channel-1/profile-1/image.png');

    expect(audioMessage.core.type).toBe('audio-recording');
    if (audioMessage.core.type !== 'audio-recording') {
      throw new Error('Expected audio message');
    }
    expect(audioMessage.audio.storagePath).toBe('org-1/channel-1/profile-1/audio.m4a');
  });
});
