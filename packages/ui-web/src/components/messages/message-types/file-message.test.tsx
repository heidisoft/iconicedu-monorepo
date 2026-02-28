import { describe, expect, it } from 'vitest';

import { formatFileSize } from './file-message';

describe('formatFileSize', () => {
  it('formats file sizes into readable units', () => {
    expect(formatFileSize()).toBe('');
    expect(formatFileSize(512)).toBe('512.0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });
});
