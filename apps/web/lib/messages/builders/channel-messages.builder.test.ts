import { describe, expect, it, vi } from 'vitest';

import { buildChannelFiles } from '@iconicedu/web/lib/messages/builders/channel-messages.builder';

const getChannelFilesByChannelIds = vi.fn();
const getChannelMediaByChannelIds = vi.fn();
const createSignedChannelFileUrl = vi.fn();

vi.mock('@iconicedu/web/lib/messages/queries/messages.query', () => ({
  getChannelFilesByChannelIds: (...args: unknown[]) =>
    getChannelFilesByChannelIds(...args),
  getChannelMediaByChannelIds: (...args: unknown[]) =>
    getChannelMediaByChannelIds(...args),
}));

vi.mock('@iconicedu/web/lib/messages/queries/file-url.query', () => ({
  createSignedChannelFileUrl: (...args: unknown[]) => createSignedChannelFileUrl(...args),
}));

describe('buildChannelFiles', () => {
  it('returns signed files and image media in one createdAt-sorted list', async () => {
    getChannelFilesByChannelIds.mockResolvedValueOnce({
      data: [
        {
          id: 'file-row-1',
          org_id: 'org-1',
          channel_id: 'channel-1',
          message_id: 'message-file-1',
          sender_profile_id: 'profile-1',
          kind: 'file',
          url: 'org-1/channel-1/files/profile-1/worksheet.pdf',
          name: 'Worksheet.pdf',
          mime_type: 'application/pdf',
          size: 2048,
          tool: null,
          created_at: '2026-02-20T10:00:00.000Z',
        },
      ],
    });
    getChannelMediaByChannelIds.mockResolvedValueOnce({
      data: [
        {
          id: 'media-row-1',
          org_id: 'org-1',
          channel_id: 'channel-1',
          message_id: 'message-image-1',
          sender_profile_id: 'profile-2',
          type: 'image',
          url: 'org-1/channel-1/images/profile-2/photo.png',
          name: 'photo.png',
          width: 800,
          height: 600,
          created_at: '2026-02-21T10:00:00.000Z',
        },
      ],
    });
    createSignedChannelFileUrl
      .mockResolvedValueOnce('https://signed.example.com/worksheet.pdf')
      .mockResolvedValueOnce('https://signed.example.com/photo.png');

    const result = await buildChannelFiles({} as never, 'org-1', 'channel-1');

    expect(result).toEqual([
      {
        ids: { id: 'media-row-1', orgId: 'org-1', channelId: 'channel-1' },
        messageId: 'message-image-1',
        senderId: 'profile-2',
        kind: 'file',
        url: 'https://signed.example.com/photo.png',
        storagePath: 'org-1/channel-1/images/profile-2/photo.png',
        name: 'photo.png',
        mimeType: 'image/*',
        createdAt: '2026-02-21T10:00:00.000Z',
      },
      {
        ids: { id: 'file-row-1', orgId: 'org-1', channelId: 'channel-1' },
        messageId: 'message-file-1',
        senderId: 'profile-1',
        kind: 'file',
        url: 'https://signed.example.com/worksheet.pdf',
        storagePath: 'org-1/channel-1/files/profile-1/worksheet.pdf',
        name: 'Worksheet.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        tool: undefined,
        createdAt: '2026-02-20T10:00:00.000Z',
      },
    ]);
  });
});
