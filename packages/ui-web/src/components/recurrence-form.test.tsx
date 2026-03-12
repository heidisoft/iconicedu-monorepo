import { describe, expect, it } from 'vitest';

import {
  addOneHour,
  buildSingleDayWeekdayTime,
  buildWeekdayEndTimes,
  deriveEndTimeOnStartTimeChange,
  getWeekdayFromDate,
  isEndTimeAfterStartTime,
  isNoRepeatDefault,
  shouldShowExceptionsAndOverrides,
} from './recurrence-form';

describe('addOneHour', () => {
  it('adds one hour and keeps minutes', () => {
    expect(addOneHour('14:30')).toBe('15:30');
  });

  it('wraps over midnight', () => {
    expect(addOneHour('23:15')).toBe('00:15');
  });
});

describe('buildWeekdayEndTimes', () => {
  it('derives end times from weekday start times', () => {
    const endTimes = buildWeekdayEndTimes([{ day: 'MO', time: '14:30' }]);
    const monday = endTimes.find((entry) => entry.day === 'MO');

    expect(monday?.time).toBe('15:30');
  });
});

describe('getWeekdayFromDate', () => {
  it('maps JS day indexes to weekday codes', () => {
    expect(getWeekdayFromDate(new Date(2026, 2, 10, 12, 0, 0))).toBe('TU');
    expect(getWeekdayFromDate(new Date(2026, 2, 8, 12, 0, 0))).toBe('SU');
  });
});

describe('buildSingleDayWeekdayTime', () => {
  it('builds a weekday-time entry from the start date and selected time', () => {
    expect(buildSingleDayWeekdayTime(new Date(2026, 2, 10, 12, 0, 0), '08:45')).toEqual([
      { day: 'TU', time: '08:45' },
    ]);
  });
});

describe('isNoRepeatDefault', () => {
  it('detects schedules without recurrence rule', () => {
    expect(
      isNoRepeatDefault({
        exceptions: [],
        overrides: [],
      }),
    ).toBe(true);
  });

  it('returns false when recurrence modifiers exist', () => {
    expect(
      isNoRepeatDefault({
        rule: { frequency: 'weekly', count: 1, interval: 2 },
        exceptions: [],
        overrides: [],
      }),
    ).toBe(false);
  });
});

describe('shouldShowExceptionsAndOverrides', () => {
  it('hides exceptions/overrides while creating new schedules', () => {
    expect(shouldShowExceptionsAndOverrides(false, 'weekly')).toBe(false);
    expect(shouldShowExceptionsAndOverrides(false, 'daily')).toBe(false);
  });

  it('shows exceptions/overrides only while editing repeating schedules', () => {
    expect(shouldShowExceptionsAndOverrides(true, 'weekly')).toBe(true);
    expect(shouldShowExceptionsAndOverrides(true, 'none')).toBe(false);
  });
});

describe('RecurrenceForm time defaults', () => {
  it('always sets end time to one hour ahead when start time changes', () => {
    expect(
      deriveEndTimeOnStartTimeChange({
        nextStartTime: '12:30',
      }),
    ).toBe('13:30');
    expect(
      deriveEndTimeOnStartTimeChange({
        nextStartTime: '12:00',
      }),
    ).toBe('13:00');
  });
});

describe('isEndTimeAfterStartTime', () => {
  it('requires end time to be after start time', () => {
    expect(isEndTimeAfterStartTime('09:00', '10:00')).toBe(true);
    expect(isEndTimeAfterStartTime('09:00', '09:00')).toBe(false);
    expect(isEndTimeAfterStartTime('09:00', '08:59')).toBe(false);
  });
});
