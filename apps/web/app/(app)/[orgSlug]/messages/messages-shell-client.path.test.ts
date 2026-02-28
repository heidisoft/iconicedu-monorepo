import { describe, expect, it, vi } from 'vitest';

import { buildMessageFileStoragePath } from '@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client';

describe('buildMessageFileStoragePath', () => {
  it('builds tenant and asset-typed storage paths', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'abcd1234-ffff-eeee-dddd-ccccbbbb0000',
    );

    const imageFile = new File(['image'], 'Class Photo.png', { type: 'image/png' });
    const audioFile = new File(['audio'], 'Voice Note.m4a', { type: 'audio/mp4' });
    const pdfFile = new File(['pdf'], 'Lesson Brief.pdf', { type: 'application/pdf' });

    expect(
      buildMessageFileStoragePath({
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        file: imageFile,
      }),
    ).toBe('org-1/channel-1/images/profile-1/1700000000000-abcd1234-Class-Photo.png');

    expect(
      buildMessageFileStoragePath({
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        file: audioFile,
      }),
    ).toBe('org-1/channel-1/audio/profile-1/1700000000000-abcd1234-Voice-Note.m4a');

    expect(
      buildMessageFileStoragePath({
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        file: pdfFile,
      }),
    ).toBe('org-1/channel-1/files/profile-1/1700000000000-abcd1234-Lesson-Brief.pdf');

    randomUuidSpy.mockRestore();
    dateNowSpy.mockRestore();
  });
});
