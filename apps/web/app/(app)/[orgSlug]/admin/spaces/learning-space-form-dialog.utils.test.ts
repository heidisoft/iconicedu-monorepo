import { describe, expect, it } from 'vitest';

import type { RecurrenceFormData } from '@iconicedu/ui-web/lib/recurrence-types';
import {
  mapSchedulesToPayload,
  normalizeSchedules,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-space-form-dialog.utils';

describe('learning-space-form-dialog schedule utils', () => {
  it('preserves exceptions and overrides in payload mapping', () => {
    const schedules: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: new Date('2026-03-10T14:00:00.000Z'),
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [{ id: 'exception-1', date: '2026-03-17', reason: 'Holiday' }],
        overrides: [
          {
            id: 'override-1',
            originalDate: '2026-03-24',
            newDate: '2026-03-25',
            newTime: '15:00',
            reason: 'Rescheduled',
          },
        ],
      },
    ];

    expect(mapSchedulesToPayload(schedules)).toEqual([
      {
        startDate: '2026-03-10T14:00:00.000Z',
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
        overrides: [
          {
            originalDate: '2026-03-24',
            newDate: '2026-03-25',
            newTime: '15:00',
            reason: 'Rescheduled',
          },
        ],
      },
    ]);
  });

  it('normalizes schedules without sharing nested references', () => {
    const source: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: '2026-03-10T14:00:00.000Z' as unknown as Date,
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [{ id: 'exception-1', date: '2026-03-17', reason: 'Holiday' }],
        overrides: [
          {
            id: 'override-1',
            originalDate: '2026-03-24',
            newDate: '2026-03-25',
            newTime: '15:00',
            reason: 'Rescheduled',
          },
        ],
      },
    ];

    const normalized = normalizeSchedules(source);

    expect(normalized[0]?.startDate).toBeInstanceOf(Date);
    expect(normalized[0]?.exceptions).toEqual(source[0]?.exceptions);
    expect(normalized[0]?.overrides).toEqual(source[0]?.overrides);
    expect(normalized[0]?.exceptions).not.toBe(source[0]?.exceptions);
    expect(normalized[0]?.overrides).not.toBe(source[0]?.overrides);
    expect(normalized[0]?.rule.weekdayTimes).not.toBe(source[0]?.rule.weekdayTimes);
  });
});
