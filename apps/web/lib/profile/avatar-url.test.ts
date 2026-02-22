import { describe, expect, it, vi } from 'vitest';

import { resolveProfileAvatarUrl } from '@iconicedu/web/lib/profile/avatar-url';

function makeSupabase({
  signedUrl,
  signedError = null,
  publicUrl = 'https://example.com/public-avatar.jpg',
}: {
  signedUrl?: string | null;
  signedError?: unknown;
  publicUrl?: string;
}) {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: signedUrl ?? null },
    error: signedError,
  });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl },
  });
  const from = vi.fn().mockReturnValue({ createSignedUrl, getPublicUrl });
  const supabase = {
    storage: {
      from,
    },
  } as unknown as Parameters<typeof resolveProfileAvatarUrl>[0];
  return { supabase, createSignedUrl, getPublicUrl, from };
}

describe('resolveProfileAvatarUrl', () => {
  it('returns null for empty avatar', async () => {
    const { supabase } = makeSupabase({});
    expect(await resolveProfileAvatarUrl(supabase, 'upload', null)).toBeNull();
  });

  it('returns existing full URL as-is', async () => {
    const { supabase, createSignedUrl } = makeSupabase({});
    const url = 'https://cdn.example.com/avatar.png';
    expect(await resolveProfileAvatarUrl(supabase, 'upload', url)).toBe(url);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns signed URL for upload avatars when available', async () => {
    const { supabase, createSignedUrl, getPublicUrl } = makeSupabase({
      signedUrl: 'https://example.com/signed-avatar.jpg',
    });
    expect(await resolveProfileAvatarUrl(supabase, 'upload', 'org/p/avatar.jpg')).toBe(
      'https://example.com/signed-avatar.jpg',
    );
    expect(createSignedUrl).toHaveBeenCalled();
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it('falls back to public URL when signed URL cannot be created', async () => {
    const { supabase, getPublicUrl } = makeSupabase({
      signedUrl: null,
      signedError: { message: 'forbidden' },
      publicUrl: 'https://example.com/public-avatar.jpg',
    });
    expect(await resolveProfileAvatarUrl(supabase, 'upload', 'org/p/avatar.jpg')).toBe(
      'https://example.com/public-avatar.jpg',
    );
    expect(getPublicUrl).toHaveBeenCalledWith('org/p/avatar.jpg');
  });

  it('returns raw value for non-upload sources', async () => {
    const { supabase, createSignedUrl } = makeSupabase({});
    expect(await resolveProfileAvatarUrl(supabase, 'seed', 'seed-value')).toBe('seed-value');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

