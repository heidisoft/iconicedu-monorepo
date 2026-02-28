import { describe, expect, it } from 'vitest';

import { formatFileSize, getFileAttachments } from './file-message';

describe('formatFileSize', () => {
  it('formats file sizes into readable units', () => {
    expect(formatFileSize()).toBe('');
    expect(formatFileSize(512)).toBe('512.0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('returns grouped file attachments when present', () => {
    expect(
      getFileAttachments({
        attachment: { type: 'file', name: 'first.pdf', url: 'https://example.com/first.pdf' },
        attachments: [
          { type: 'file', name: 'first.pdf', url: 'https://example.com/first.pdf' },
          { type: 'file', name: 'second.pdf', url: 'https://example.com/second.pdf' },
        ],
      } as never).map((attachment) => attachment.name),
    ).toEqual(['first.pdf', 'second.pdf']);
  });
});
