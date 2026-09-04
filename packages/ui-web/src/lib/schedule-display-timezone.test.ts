import { describe, expect, it } from 'vitest';

import {
  formatScheduleDisplayTimeWithZone,
  getScheduleDisplayDateParts,
  getScheduleDisplayDayKey,
  getScheduleDisplayMinutes,
  resolveScheduleDisplayTimeZone,
  toScheduleDisplayDate,
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

  it('formats using the viewer timezone label for the occurrence date', () => {
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
    ).toBe('1:30 AM Sri Lanka time');
  });

  describe('viewer-local midnight', () => {
    // 2026-08-29T18:30Z is exactly 2026-08-30T00:00 in Asia/Colombo. en-US with
    // `hour12: false` reports that as hour 24, which used to roll the date to
    // the 31st once it reached the `Date` constructor.
    const colomboMidnight = '2026-08-29T18:30:00.000Z';

    it('reports hour 0 rather than hour 24', () => {
      expect(getScheduleDisplayDateParts(colomboMidnight, 'Asia/Colombo')).toMatchObject({
        year: 2026,
        month: 8,
        day: 30,
        hour: 0,
        minute: 0,
      });
    });

    it('does not advance the calendar date', () => {
      const displayDate = toScheduleDisplayDate(colomboMidnight, 'Asia/Colombo');

      expect(displayDate?.getFullYear()).toBe(2026);
      expect(displayDate?.getMonth()).toBe(7);
      expect(displayDate?.getDate()).toBe(30);
      expect(displayDate?.getHours()).toBe(0);
    });

    it('keeps the day key and minute offset on the correct date', () => {
      expect(getScheduleDisplayDayKey(colomboMidnight, 'Asia/Colombo')).toBe(
        '2026-08-30',
      );
      expect(getScheduleDisplayMinutes(colomboMidnight, 'Asia/Colombo')).toBe(0);
    });

    it('still handles a non-midnight instant on the same day', () => {
      expect(getScheduleDisplayDayKey('2026-08-30T13:30:00.000Z', 'Asia/Colombo')).toBe(
        '2026-08-30',
      );
      expect(getScheduleDisplayMinutes('2026-08-30T13:30:00.000Z', 'Asia/Colombo')).toBe(
        19 * 60,
      );
    });
  });
});
