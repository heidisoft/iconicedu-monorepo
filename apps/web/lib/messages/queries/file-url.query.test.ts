import { describe, expect, it, vi } from 'vitest';

import { CHANNEL_FILE_BUCKET, CHANNEL_FILE_SIGNED_URL_TTL, createSignedChannelFileUrl } from '@iconicedu/web/lib/messages/queries/file-url.query';

describe('createSignedChannelFileUrl', () => {
  it('returns absolute urls unchanged', async () => {
    const supabase = { storage: { from: vi.fn() } } as any;

    await expect(
      createSignedChannelFileUrl(supabase, 'https://cdn.example.com/file.pdf'),
    ).resolves.toBe('https://cdn.example.com/file.pdf');

    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('creates signed urls for storage paths', async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: 'https://signed.example.com/file.pdf' },
      error: null,
    }));
    const from = vi.fn(() => ({ createSignedUrl }));
    const supabase = { storage: { from } } as any;

    await expect(
      createSignedChannelFileUrl(supabase, 'org-1/channel-1/profile-1/file.pdf'),
    ).resolves.toBe('https://signed.example.com/file.pdf');

    expect(from).toHaveBeenCalledWith(CHANNEL_FILE_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      'org-1/channel-1/profile-1/file.pdf',
      CHANNEL_FILE_SIGNED_URL_TTL,
    );
  });
});
