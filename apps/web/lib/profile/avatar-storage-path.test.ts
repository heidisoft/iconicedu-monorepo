import { describe, expect, it, vi } from 'vitest';

import { buildAvatarStoragePath } from '@iconicedu/web/lib/profile/avatar-storage-path';

describe('buildAvatarStoragePath', () => {
  it('builds tenant-first avatar paths with a typed segment', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('abcd1234-ffff-eeee-dddd-ccccbbbb0000');

    const file = new File(['avatar'], 'Profile Photo.PNG', { type: 'image/png' });

    expect(
      buildAvatarStoragePath({
        orgId: 'org-1',
        profileId: 'profile-1',
        file,
      }),
    ).toBe('org-1/avatars/profile-1/1700000000000-abcd1234-Profile-Photo.png');

    randomUuidSpy.mockRestore();
    dateNowSpy.mockRestore();
  });
});
