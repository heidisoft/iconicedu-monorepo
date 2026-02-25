import { describe, expect, it } from 'vitest';
import type { MonthGroup } from './messages-schedule-tab.utils';
import {
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
    });
    expect(
      getMonthSectionStats({ ...monthGroup, completedCount: 4 }),
    ).toEqual({
      progressPercent: 100,
      allComplete: true,
    });
  });

  it('opens first/current sections by default when requested', () => {
    expect(shouldMonthSectionStartOpen(true, false)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, true)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, false)).toBe(false);
  });
});
