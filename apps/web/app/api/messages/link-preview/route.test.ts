import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/link-preview/route';

const fetchLinkPreviewMetadata = vi.fn();

vi.mock('@iconicedu/web/lib/messages/link-preview', () => ({
  fetchLinkPreviewMetadata: (...args: unknown[]) => fetchLinkPreviewMetadata(...args),
}));

describe('GET /api/messages/link-preview', () => {
  it('returns 400 when url is missing', async () => {
    const response = await GET(
      new Request('https://app.iconicedu.test/api/messages/link-preview'),
    );

    expect(response.status).toBe(400);
  });

  it('returns fetched metadata for a valid url', async () => {
    fetchLinkPreviewMetadata.mockResolvedValueOnce({
      url: 'https://example.com/post',
      title: 'Example Post',
      description: 'Preview description',
      siteName: 'Example',
    });

    const response = await GET(
      new Request(
        'https://app.iconicedu.test/api/messages/link-preview?url=https%3A%2F%2Fexample.com%2Fpost',
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        url: 'https://example.com/post',
        title: 'Example Post',
        description: 'Preview description',
        siteName: 'Example',
      },
    });
  });
});
