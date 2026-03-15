import { describe, expect, it } from 'vitest';

import {
  formatScheduleDisplayTimeWithZone,
  resolveScheduleDisplayTimeZone,
} from './schedule-display-timezone';

describe('schedule-display-timezone', () => {
  it('prefers the viewer timezone over the schedule timezone for schedule surfaces', () => {
    expect(
      resolveScheduleDisplayTimeZone({
        viewerTimezone: 'Asia/Colombo',
        scheduleTimezone: 'America/New_York',
      }),
    ).toBe('Asia/Colombo');
  });

  it('formats using the viewer timezone abbreviation for the occurrence date', () => {
    expect(
      formatScheduleDisplayTimeWithZone(
        '2026-03-08T20:00:00.000Z',
        {
          viewerTimezone: 'Asia/Colombo',
          scheduleTimezone: 'America/New_York',
        },
        {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        },
      ),
    ).toBe('1:30 AM GMT+5:30');
  });
});
