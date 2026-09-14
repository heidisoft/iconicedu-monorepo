import { describe, expect, it } from 'vitest';

import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatAttendanceDuration,
  formatAttendancePercent,
  formatAttendanceTimeOfDay,
  getAttendanceStatusTone,
  getParticipantAttendanceTone,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';

describe('live-session-attendance.utils', () => {
  it('formats empty date values as em dash', () => {
    expect(formatAttendanceDateTime(null)).toBe('—');
  });

  it('formats a date without a time-of-day component', () => {
    // Renders in the local timezone, so only assert the shape ("MMM D, YYYY"),
    // not the exact day — a UTC boundary could shift it either way.
    expect(formatAttendanceDate('2026-09-01T13:00:00.000Z')).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}, 202[56]$/,
    );
    expect(formatAttendanceDate(null)).toBe('—');
    expect(formatAttendanceDate(undefined)).toBe('—');
  });

  it('formats just the time of day', () => {
    // Renders in the local timezone, so only assert the shape, not the exact hour.
    expect(formatAttendanceTimeOfDay('2026-09-01T13:00:00.000Z')).toMatch(
      /^\d{1,2}:\d{2}\s?(AM|PM)$/,
    );
    expect(formatAttendanceTimeOfDay(null)).toBe('—');
  });

  it('formats duration values into readable strings', () => {
    expect(formatAttendanceDuration(3600)).toBe('1h 0m');
    expect(formatAttendanceDuration(1800)).toBe('30m');
    expect(formatAttendanceDuration(null)).toBe('—');
  });

  it('maps attendance statuses to badge tones', () => {
    expect(getAttendanceStatusTone('live')).toBe('default');
    expect(getAttendanceStatusTone('failed')).toBe('destructive');
    expect(getAttendanceStatusTone('ended')).toBe('secondary');
  });

  it('formats attendance ratios and maps participant statuses', () => {
    expect(formatAttendancePercent(0.9)).toBe('90%');
    expect(formatAttendancePercent(null)).toBe('—');
    expect(getParticipantAttendanceTone('full')).toBe('default');
    expect(getParticipantAttendanceTone('no_show')).toBe('destructive');
    expect(getParticipantAttendanceTone('partial')).toBe('secondary');
    expect(getParticipantAttendanceTone('expected')).toBe('outline');
  });
});
