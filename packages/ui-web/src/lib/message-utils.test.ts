import { describe, expect, it } from 'vitest';

import {
  formatDateHeader,
  formatDuration,
  formatFileSize,
  formatFullDate,
  formatThreadTime,
  formatTime,
} from './message-utils';

describe('message-utils', () => {
  it('formats basic values', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats message timestamps in viewer timezone', () => {
    const value = '2026-03-09T13:00:00.000Z';
    expect(formatTime(value)).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    expect(formatFullDate(value)).toContain('2026');
  });

  it('renders humanized thread and date headers', () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatThreadTime(thirtyMinutesAgo)).toBe('30m ago');
    expect(formatDateHeader(new Date().toISOString())).toBe('Today');
  });
});
