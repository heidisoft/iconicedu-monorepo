import { describe, expect, it } from 'vitest';

import {
  formatDaysSummary,
  formatInlineScheduleTime,
  formatScheduleSummaryWithTime,
  formatTimeRangeWithMeridiem,
  formatTimeWithMeridiem,
  formatWeeklyRecurrenceSummary,
  formatWeeklyRecurrenceSummaryWithTime,
} from './recurrence-scheduler';

describe('recurrence-scheduler preview formatting', () => {
  it('formats inline time with short weekday prefix', () => {
    expect(formatInlineScheduleTime(new Date(2026, 2, 5), '15:00', '16:00')).toBe(
      'Thu 15:00 - 16:00',
    );
  });

  it('formats multi-day summary using short weekday tokens only', () => {
    expect(formatDaysSummary(['MO', 'TH'])).toBe('M, T');
  });

  it('formats weekly recurrence summary with full weekday labels', () => {
    expect(formatWeeklyRecurrenceSummary(['MO'])).toBe('Weekly · Every Monday');
    expect(formatWeeklyRecurrenceSummary(['MO', 'TH'])).toBe(
      'Weekly · Every Monday, Thursday',
    );
  });

  it('formats weekly recurrence summary with time range', () => {
    expect(formatWeeklyRecurrenceSummaryWithTime(['MO'], '15:00', '16:00')).toBe(
      'Weekly · Every Monday · 3:00 PM - 4:00 PM',
    );
  });

  it('formats 24-hour times to AM/PM', () => {
    expect(formatTimeWithMeridiem('00:05')).toBe('12:05 AM');
    expect(formatTimeWithMeridiem('12:00')).toBe('12:00 PM');
    expect(formatTimeWithMeridiem('17:00')).toBe('5:00 PM');
    expect(formatTimeRangeWithMeridiem('09:00', '18:30')).toBe('9:00 AM - 6:30 PM');
  });

  it('formats schedule summary based on recurrence type and no-repeat', () => {
    expect(
      formatScheduleSummaryWithTime({
        startDate: new Date(2026, 2, 5),
        startTime: '17:00',
        endTime: '18:00',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TH'],
        },
      }),
    ).toBe('Weekly · Every Thursday · 5:00 PM - 6:00 PM');

    expect(
      formatScheduleSummaryWithTime({
        startDate: new Date(2026, 2, 5),
        startTime: '17:00',
        endTime: '18:00',
        rule: {
          frequency: 'daily',
        },
      }),
    ).toBe('Daily · Every day · 5:00 PM - 6:00 PM');

    expect(
      formatScheduleSummaryWithTime({
        startDate: new Date(2026, 2, 5),
        startTime: '17:00',
        endTime: '18:00',
        rule: {
          frequency: 'monthly',
        },
      }),
    ).toBe('Monthly · Every month · 5:00 PM - 6:00 PM');

    expect(
      formatScheduleSummaryWithTime({
        startDate: new Date(2026, 2, 5),
        startTime: '17:00',
        endTime: '18:00',
        rule: {
          frequency: 'yearly',
        },
      }),
    ).toBe('Yearly · Every year · 5:00 PM - 6:00 PM');

    expect(
      formatScheduleSummaryWithTime({
        startDate: new Date(2026, 2, 5),
        startTime: '17:00',
        endTime: '18:00',
      }),
    ).toBe('No repeat · 5:00 PM - 6:00 PM');
  });
});
