import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  extractFirstUrl,
  fetchLinkPreviewMetadata,
  isSafeLinkPreviewUrl,
} from './link-preview';

function mockResponse(input: {
  status?: number;
  headers?: Record<string, string>;
  text?: string;
  bodyChunks?: string[];
}) {
  const headerMap = new Map(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const status = input.status ?? 200;

  const body = input.bodyChunks
    ? {
        getReader: () => {
          const chunks = [...input.bodyChunks!];
          return {
            read: async () => {
              const chunk = chunks.shift();
              if (chunk === undefined) return { done: true, value: undefined };
              return { done: false, value: new TextEncoder().encode(chunk) };
            },
            cancel: async () => undefined,
          };
        },
      }
    : undefined;

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headerMap.get(key.toLowerCase()) ?? null },
    text: async () => input.text ?? '',
    body,
  } as unknown as Response;
}

describe('link-preview helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts the first URL from message text', () => {
    expect(extractFirstUrl('Check this https://example.com/page now')).toBe(
      'https://example.com/page',
    );
    expect(extractFirstUrl('No link here')).toBeNull();
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

  it('fetches og metadata and resolves relative asset urls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockResponse({
          text: `
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
        }),
      ),
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

  it('follows a same-safety-class redirect and re-validates the target', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://example.com/short') {
        return mockResponse({
          status: 302,
          headers: { location: 'https://example.com/final' },
        });
      }
      return mockResponse({ text: '<title>Final Page</title>' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchLinkPreviewMetadata('https://example.com/short')).resolves.toEqual(
      expect.objectContaining({ url: 'https://example.com/final', title: 'Final Page' }),
    );
  });

  it('does not follow a redirect into a private/unsafe host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockResponse({
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data' },
        }),
      ),
    );

    await expect(fetchLinkPreviewMetadata('https://example.com/short')).resolves.toEqual({
      url: 'https://example.com/short',
      title: 'example.com',
      siteName: 'example.com',
      favicon: 'https://example.com/favicon.ico',
    });
  });

  it('skips parsing a non-HTML response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockResponse({
          headers: { 'content-type': 'application/pdf' },
          text: '%PDF-1.4 binary garbage',
        }),
      ),
    );

    await expect(
      fetchLinkPreviewMetadata('https://example.com/file.pdf'),
    ).resolves.toEqual({
      url: 'https://example.com/file.pdf',
      title: 'example.com',
      siteName: 'example.com',
      favicon: 'https://example.com/favicon.ico',
    });
  });

  it('stops reading the body once the size cap is reached', async () => {
    // The closing </title> tag arrives in a second chunk that the 512KB cap
    // never lets the reader get to, so the tag can't be parsed out.
    const oversizedOpenChunk = `<title>${'a'.repeat(600_000)}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockResponse({ bodyChunks: [oversizedOpenChunk, '</title>'] })),
    );

    const result = await fetchLinkPreviewMetadata('https://example.com/huge');
    expect(result.title).toBe('example.com');
  });
});
