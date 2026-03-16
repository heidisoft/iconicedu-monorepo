import { describe, expect, it } from 'vitest';

import {
  buildFileAccessHref,
  buildFileDownloadHref,
  buildImageRenderHref,
} from './file-download.utils';

describe('buildFileDownloadHref', () => {
  it('uses the stable access endpoint when storagePath exists', () => {
    expect(
      buildFileAccessHref({
        url: 'https://signed.example.com/file.pdf',
        storagePath: 'org-1/channel-1/profile-1/file.pdf',
      }),
    ).toBe('/api/messages/file-download?path=org-1%2Fchannel-1%2Fprofile-1%2Ffile.pdf');
  });

  it('uses a public image thumbnail when present', () => {
    expect(
      buildImageRenderHref({
        url: 'https://signed.example.com/image.png',
        storagePath: 'org-1/channel-1/profile-1/image.png',
        thumbnailUrl: 'https://public.example.com/thumb.jpg',
      }),
    ).toBe('https://public.example.com/thumb.jpg');
  });

  it('uses the re-signing endpoint when storagePath exists', () => {
    expect(
      buildFileDownloadHref({
        url: 'https://signed.example.com/file.pdf',
        storagePath: 'org-1/channel-1/profile-1/file.pdf',
      }),
    ).toBe('/api/messages/file-download?path=org-1%2Fchannel-1%2Fprofile-1%2Ffile.pdf');
  });

  it('falls back to the direct url when storagePath is missing', () => {
    expect(
      buildFileDownloadHref({
        url: 'https://signed.example.com/file.pdf',
      }),
    ).toBe('https://signed.example.com/file.pdf');
  });
});
