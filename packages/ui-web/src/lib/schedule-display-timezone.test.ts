import { describe, expect, it } from 'vitest';

import {
  formatScheduleDisplayTimeWithZone,
  resolveScheduleDisplayTimeZone,
} from './schedule-display-timezone';

describe('schedule-display-timezone', () => {
  it('prefers the schedule timezone over the viewer timezone for schedule surfaces', () => {
    expect(
      resolveScheduleDisplayTimeZone({
        viewerTimezone: 'Asia/Colombo',
        scheduleTimezone: 'America/New_York',
      }),
    ).toBe('America/New_York');
  });

  it('formats using the schedule timezone abbreviation for the occurrence date', () => {
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
    ).toBe('4:00 PM EDT');
  });
});
