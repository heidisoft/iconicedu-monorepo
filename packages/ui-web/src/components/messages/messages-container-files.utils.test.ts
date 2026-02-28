import { describe, expect, it } from 'vitest';

import { createChannelFileItem } from './messages-container-files.utils';

describe('createChannelFileItem', () => {
  it('maps an image message into a files-tab item', () => {
    const item = createChannelFileItem('channel-1', {
      ids: { id: 'message-1', orgId: 'org-1' },
      core: {
        type: 'image',
        createdAt: '2026-02-23T10:00:00.000Z',
        visibility: { type: 'all' },
        sender: { ids: { id: 'profile-1' } },
      },
      social: { reactions: [] },
      attachment: {
        type: 'image',
        url: 'https://example.com/photo.png',
        storagePath: 'org-1/channel-1/images/profile-1/photo.png',
        name: 'photo.png',
      },
    } as never);

    expect(item).toEqual(
      expect.objectContaining({
        messageId: 'message-1',
        name: 'photo.png',
        mimeType: 'image/*',
        storagePath: 'org-1/channel-1/images/profile-1/photo.png',
      }),
    );
  });

  it('maps an audio recording into a files-tab item using the storage file name', () => {
    const item = createChannelFileItem('channel-1', {
      ids: { id: 'message-2', orgId: 'org-1' },
      core: {
        type: 'audio-recording',
        createdAt: '2026-02-24T10:00:00.000Z',
        visibility: { type: 'all' },
        sender: { ids: { id: 'profile-2' } },
      },
      social: { reactions: [] },
      audio: {
        url: 'https://example.com/voice.webm',
        storagePath: 'org-1/channel-1/audio/profile-2/voice.webm',
        durationSeconds: 9,
        fileSize: 55,
        mimeType: 'audio/webm',
      },
    } as never);

    expect(item).toEqual(
      expect.objectContaining({
        messageId: 'message-2',
        name: 'voice.webm',
        mimeType: 'audio/webm',
        size: 55,
      }),
    );
  });
});
