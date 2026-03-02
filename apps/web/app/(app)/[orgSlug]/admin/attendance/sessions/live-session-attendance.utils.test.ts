import { describe, expect, it } from 'vitest';

import {
  formatAttendanceDateTime,
  formatAttendanceDuration,
  getAttendanceStatusTone,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';

describe('live-session-attendance.utils', () => {
  it('formats empty date values as em dash', () => {
    expect(formatAttendanceDateTime(null)).toBe('—');
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
});
