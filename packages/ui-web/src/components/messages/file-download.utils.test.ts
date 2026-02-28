import { describe, expect, it } from 'vitest';

import { buildFileDownloadHref } from './file-download.utils';

describe('buildFileDownloadHref', () => {
  it('uses the re-signing endpoint when storagePath exists', () => {
    expect(
      buildFileDownloadHref({
        url: 'https://signed.example.com/file.pdf',
        storagePath: 'org-1/channel-1/profile-1/file.pdf',
      }),
    ).toBe(
      '/api/messages/file-download?path=org-1%2Fchannel-1%2Fprofile-1%2Ffile.pdf',
    );
  });

  it('falls back to the direct url when storagePath is missing', () => {
    expect(
      buildFileDownloadHref({
        url: 'https://signed.example.com/file.pdf',
      }),
    ).toBe('https://signed.example.com/file.pdf');
  });
});
