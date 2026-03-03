import { describe, expect, it } from 'vitest';

import { __test__ } from '@iconicedu/web/lib/live-sessions/expected-participants';

describe('expected-participants', () => {
  it('returns the default hybrid attendance policy when config is missing', () => {
    expect(__test__.getLiveSessionAttendancePolicy(null)).toEqual({
      fullAttendanceThresholdPercent: 90,
      graceSeconds: 0,
      countLateJoinAsAttended: true,
      countRejoins: true,
      source: 'hybrid',
    });
  });

  it('parses a stored attendance policy with supported keys', () => {
    expect(
      __test__.getLiveSessionAttendancePolicy({
        fullAttendanceThresholdPercent: 95,
        graceSeconds: 120,
        countLateJoinAsAttended: false,
        countRejoins: false,
      }),
    ).toEqual({
      fullAttendanceThresholdPercent: 95,
      graceSeconds: 120,
      countLateJoinAsAttended: false,
      countRejoins: false,
      source: 'hybrid',
    });
  });
});
