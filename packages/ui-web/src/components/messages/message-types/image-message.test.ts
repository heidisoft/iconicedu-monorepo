import { describe, expect, it } from 'vitest';

import { getImageDownloadHref } from './image-message';

describe('getImageDownloadHref', () => {
  it('uses the re-signing endpoint when image storagePath exists', () => {
    expect(
      getImageDownloadHref({
        ids: { id: 'message-1', orgId: 'org-1' },
        core: {
          type: 'image',
          createdAt: '2026-01-01T10:00:00.000Z',
          visibility: { type: 'all' },
          sender: {} as never,
        },
        social: { reactions: [] },
        attachment: {
          type: 'image',
          url: 'https://signed.example.com/image.png',
          storagePath: 'org-1/channel-1/profile-1/image.png',
          name: 'image.png',
        },
      } as never),
    ).toBe('/api/messages/file-download?path=org-1%2Fchannel-1%2Fprofile-1%2Fimage.png');
  });
});
