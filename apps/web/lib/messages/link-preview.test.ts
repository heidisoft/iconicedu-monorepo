import { describe, expect, it, vi } from 'vitest';

import {
  extractFirstUrl,
  fetchLinkPreviewMetadata,
  isSafeLinkPreviewUrl,
} from '@iconicedu/web/lib/messages/link-preview';

describe('link-preview helpers', () => {
  it('extracts the first URL from message text', () => {
    expect(extractFirstUrl('Check this https://example.com/page now')).toBe(
      'https://example.com/page',
    );
    expect(extractFirstUrl('No link here')).toBeNull();
  });

  it('fetches og metadata and resolves relative asset urls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => `
          <html>
            <head>
              <title>Example Title</title>
              <meta property="og:title" content="OG Example" />
              <meta property="og:description" content="Preview description" />
              <meta property="og:image" content="/cover.png" />
              <meta property="og:site_name" content="Example Site" />
              <link rel="icon" href="/favicon.png" />
            </head>
          </html>
        `,
      })),
    );

    await expect(fetchLinkPreviewMetadata('https://example.com/post')).resolves.toEqual({
      url: 'https://example.com/post',
      title: 'OG Example',
      description: 'Preview description',
      imageUrl: 'https://example.com/cover.png',
      siteName: 'Example Site',
      favicon: 'https://example.com/favicon.png',
    });
  });

  it('falls back to hostname metadata when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );

    await expect(
      fetchLinkPreviewMetadata('https://www.example.com/post'),
    ).resolves.toEqual({
      url: 'https://www.example.com/post',
      title: 'example.com',
      siteName: 'example.com',
      favicon: 'https://www.example.com/favicon.ico',
    });
  });

  it('blocks private or non-http urls from preview fetches', async () => {
    expect(isSafeLinkPreviewUrl('http://127.0.0.1/private')).toBe(false);
    expect(isSafeLinkPreviewUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeLinkPreviewUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeLinkPreviewUrl('https://example.com/post')).toBe(true);

    await expect(fetchLinkPreviewMetadata('http://127.0.0.1/private')).rejects.toThrow(
      'Unsafe URL for link preview',
    );
  });
});
