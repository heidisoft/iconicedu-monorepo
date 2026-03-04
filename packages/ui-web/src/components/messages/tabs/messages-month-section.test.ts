import { describe, expect, it } from 'vitest';
import type { MonthGroup } from './messages-schedule-tab.utils';
import {
  formatMonthSectionProgressLabel,
  getMonthSectionStats,
  shouldMonthSectionStartOpen,
} from './messages-month-section';

const monthGroup: MonthGroup = {
  monthKey: '2026-03',
  month: 'March',
  year: '2026',
  totalCount: 4,
  completedCount: 3,
  sessions: [],
};

describe('messages-month-section', () => {
  it('calculates progress and completion flags', () => {
    expect(getMonthSectionStats(monthGroup)).toEqual({
      progressPercent: 75,
      allComplete: false,
      scheduledCount: 4,
      completedCount: 3,
    });
    expect(
      getMonthSectionStats({ ...monthGroup, completedCount: 4 }),
    ).toEqual({
      progressPercent: 100,
      allComplete: true,
      scheduledCount: 4,
      completedCount: 4,
    });
  });

  it('prefers provided scheduled-vs-completed month stats for the progress bar', () => {
    expect(
      getMonthSectionStats(monthGroup, {
        scheduledCount: 6,
        completedCount: 3,
      }),
    ).toEqual({
      progressPercent: 50,
      allComplete: false,
      scheduledCount: 6,
      completedCount: 3,
    });
  });

  it('opens first/current sections by default when requested', () => {
    expect(shouldMonthSectionStartOpen(true, false)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, true)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, false)).toBe(false);
  });

  it('formats the month progress label with percent and ratio', () => {
    expect(formatMonthSectionProgressLabel(50, 3, 6)).toBe('50% 3/6');
  });
});
