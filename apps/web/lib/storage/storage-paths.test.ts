import { describe, expect, it, vi } from 'vitest';

import {
  buildAvatarPath,
  buildMessageAssetPath,
  buildMessageThumbnailPath,
  buildOrgScopedStoragePath,
  buildStorageFileKey,
  getAvatarBucket,
  getChannelFilesBucket,
  getMessageThumbnailsBucket,
  isValidMessageAssetPath,
  sanitizeStorageFileName,
  STORAGE_BUCKETS,
  STORAGE_PATH_SEGMENTS,
} from '@iconicedu/web/lib/storage/storage-paths';

describe('storage-paths', () => {
  it('sanitizes file names with a fallback', () => {
    expect(sanitizeStorageFileName('Lesson Brief.pdf')).toBe('Lesson-Brief.pdf');
    expect(sanitizeStorageFileName('   ', 'avatar')).toBe('avatar');
  });

  it('builds randomized file keys with optional extension fallback', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('abcd1234-ffff-eeee-dddd-ccccbbbb0000');

    expect(
      buildStorageFileKey({
        name: 'Profile Photo',
        fallbackBaseName: 'avatar',
        fallbackExtension: 'jpg',
      }),
    ).toBe('1700000000000-abcd1234-Profile-Photo.jpg');

    expect(
      buildStorageFileKey({
        name: 'Lesson Brief.pdf',
        fallbackBaseName: 'file',
      }),
    ).toBe('1700000000000-abcd1234-Lesson-Brief.pdf');

    randomUuidSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it('builds org-scoped storage paths', () => {
    expect(
      buildOrgScopedStoragePath({
        orgId: 'org-1',
        segments: ['channel-1', STORAGE_PATH_SEGMENTS.files, 'profile-1'],
        fileName: '1700000000000-abcd1234-file.pdf',
      }),
    ).toBe('org-1/channel-1/files/profile-1/1700000000000-abcd1234-file.pdf');
  });

  it('builds semantic message asset and avatar paths', () => {
    expect(
      buildMessageAssetPath({
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        assetKind: STORAGE_PATH_SEGMENTS.files,
        fileName: '1700000000000-abcd1234-file.pdf',
      }),
    ).toBe('org-1/channel-1/files/profile-1/1700000000000-abcd1234-file.pdf');

    expect(
      buildAvatarPath({
        orgId: 'org-1',
        profileId: 'profile-1',
        fileName: '1700000000000-abcd1234-avatar.jpg',
      }),
    ).toBe('org-1/avatars/profile-1/1700000000000-abcd1234-avatar.jpg');

    expect(
      buildMessageThumbnailPath({
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
        fileName: '1700000000000-abcd1234-thumb.jpg',
      }),
    ).toBe('org-1/channel-1/thumbnails/profile-1/1700000000000-abcd1234-thumb.jpg');
  });

  it('exports canonical storage bucket names and path segments', () => {
    expect(STORAGE_BUCKETS.channelFiles).toBe('channel-files');
    expect(STORAGE_BUCKETS.publicMessageThumbnails).toBe('public-message-thumbnails');
    expect(STORAGE_BUCKETS.publicAvatars).toBe('public-avatars');
    expect(getChannelFilesBucket()).toBe('channel-files');
    expect(getMessageThumbnailsBucket()).toBe('public-message-thumbnails');
    expect(getAvatarBucket()).toBe('public-avatars');
    expect(STORAGE_PATH_SEGMENTS.images).toBe('images');
    expect(STORAGE_PATH_SEGMENTS.thumbnails).toBe('thumbnails');
    expect(STORAGE_PATH_SEGMENTS.audio).toBe('audio');
    expect(STORAGE_PATH_SEGMENTS.avatars).toBe('avatars');
  });

  it('validates message asset paths against org, channel, asset type, and profile', () => {
    expect(
      isValidMessageAssetPath({
        storagePath: 'org-1/channel-1/files/profile-1/1700000000000-abcd1234-file.pdf',
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
      }),
    ).toBe(true);

    expect(
      isValidMessageAssetPath({
        storagePath: 'org-1/channel-1/avatars/profile-1/1700000000000-abcd1234-file.pdf',
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
      }),
    ).toBe(false);

    expect(
      isValidMessageAssetPath({
        storagePath: 'org-1/channel-1/files/profile-2/1700000000000-abcd1234-file.pdf',
        orgId: 'org-1',
        channelId: 'channel-1',
        profileId: 'profile-1',
      }),
    ).toBe(false);
  });
});
