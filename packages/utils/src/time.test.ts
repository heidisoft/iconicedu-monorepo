import { describe, expect, it } from 'vitest';

import {
  buildOccurrenceKey,
  formatDateTime,
  formatTime,
  getTimezoneDisplayLabel,
  isOvernight,
  resolveViewerTimezone,
  toUtcFromLocal,
} from './index';

describe('time utilities', () => {
  it('resolves timezone precedence profile -> browser -> UTC', () => {
    expect(resolveViewerTimezone('America/New_York', 'America/Chicago')).toBe(
      'America/New_York',
    );
    expect(resolveViewerTimezone('', 'America/Chicago')).toBe('America/Chicago');
    expect(resolveViewerTimezone('', '')).toBe('UTC');
  });

  it('converts local date/time to UTC consistently', () => {
    const utc = toUtcFromLocal('2026-03-09', '09:00', 'America/New_York');
    expect(utc).toBe('2026-03-09T13:00:00.000Z');
  });

  it('builds occurrence keys using timezone-aware local date/time', () => {
    expect(buildOccurrenceKey('2026-03-09', '09:00', 'America/New_York')).toBe(
      '2026-03-09T13:00:00.000Z',
    );
  });

  it('formats date/time labels in a target timezone', () => {
    const value = '2026-03-09T13:00:00.000Z';
    expect(formatDateTime(value, 'America/New_York', 'natural')).toBe('Mar 9 at 9:00 AM');
    expect(formatTime(value, 'America/New_York', 'short')).toBe('9:00 AM');
    expect(formatDateTime(value, 'America/New_York', 'weekdayTimeWithZone')).toBe(
      'Mon 9:00 AM New York time',
    );
    expect(formatTime(value, 'America/New_York', 'withZone')).toBe(
      '9:00 AM New York time',
    );
  });

  it('builds human-readable timezone labels', () => {
    expect(getTimezoneDisplayLabel('America/New_York')).toBe('New York time');
    expect(getTimezoneDisplayLabel('Asia/Colombo')).toBe('Sri Lanka time');
    expect(getTimezoneDisplayLabel('UTC')).toBe('UTC time');
  });

  it('detects overnight ranges', () => {
    expect(isOvernight('22:30', '01:00')).toBe(true);
    expect(isOvernight('09:00', '10:00')).toBe(false);
  });
});
