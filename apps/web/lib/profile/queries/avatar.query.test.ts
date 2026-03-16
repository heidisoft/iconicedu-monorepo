import { describe, expect, it, vi } from 'vitest';

import {
  createPublicAvatarUrl,
  createSignedAvatarUrl,
} from '@iconicedu/web/lib/profile/queries/avatar.query';

describe('avatar.query', () => {
  it('creates signed and public URLs from the avatar bucket', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed/avatar.jpg' },
      error: null,
    });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public/avatar.jpg' },
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl, getPublicUrl });
    const supabase = {
      storage: {
        from,
      },
    } as unknown as Parameters<typeof createSignedAvatarUrl>[0];

    const signed = await createSignedAvatarUrl(
      supabase,
      'org-1/avatars/profile-1/avatar.jpg',
    );
    const publicUrl = createPublicAvatarUrl(
      supabase,
      'org-1/avatars/profile-1/avatar.jpg',
    );

    expect(from).toHaveBeenCalledWith('public-avatars');
    expect(createSignedUrl).toHaveBeenCalledWith(
      'org-1/avatars/profile-1/avatar.jpg',
      3600,
    );
    expect(getPublicUrl).toHaveBeenCalledWith('org-1/avatars/profile-1/avatar.jpg');
    expect(signed.data?.signedUrl).toBe('https://example.com/signed/avatar.jpg');
    expect(publicUrl.data.publicUrl).toBe('https://example.com/public/avatar.jpg');
  });
});
