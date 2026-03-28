import { describe, expect, it } from 'vitest';

import type { RecurrenceFormData } from '@iconicedu/ui-web/lib/recurrence-types';
import {
  buildSchedulesHashKeyFromFormSchedules,
  mapSchedulesToPayload,
  normalizeSchedules,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-space-form-dialog.utils';

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
        startDate: '2026-03-10T12:00:00.000Z',
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

  it('serializes start dates as stable date-only UTC values', () => {
    const schedules: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: new Date('2026-03-10T12:00:00.000Z'),
        timezone: 'America/New_York',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '17:02' }],
        },
        exceptions: [],
        overrides: [],
      },
    ];

    expect(mapSchedulesToPayload(schedules)[0]?.startDate).toBe(
      '2026-03-10T12:00:00.000Z',
    );
  });

  it('serializes string anchors using the schedule timezone instead of the viewer timezone', () => {
    const schedules: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: '2026-03-10T01:30:00.000Z' as unknown as Date,
        timezone: 'America/Los_Angeles',
        startTime: '17:30',
        endTime: '18:30',
        exceptions: [],
        overrides: [],
      },
    ];

    expect(mapSchedulesToPayload(schedules)[0]?.startDate).toBe(
      '2026-03-09T12:00:00.000Z',
    );
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

  it('normalizes string schedule anchors using the schedule timezone date', () => {
    const source: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: '2026-03-10T01:30:00.000Z' as unknown as Date,
        timezone: 'America/Los_Angeles',
        startTime: '17:30',
        endTime: '18:30',
        exceptions: [],
        overrides: [],
      },
    ];

    const normalized = normalizeSchedules(source);

    expect(normalized[0]?.startDate?.toISOString()).toBe('2026-03-09T12:00:00.000Z');
  });

  it('builds the same hash for reordered exception and override entries', () => {
    const first: RecurrenceFormData[] = [
      {
        id: 'schedule-1',
        startDate: new Date('2026-03-10T14:00:00.000Z'),
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [
          { id: 'exception-1', date: '2026-03-24', reason: 'Break' },
          { id: 'exception-2', date: '2026-03-17', reason: 'Holiday' },
        ],
        overrides: [
          {
            id: 'override-1',
            originalDate: '2026-04-07',
            newDate: '2026-04-08',
            newTime: '15:30',
            reason: 'Moved again',
          },
          {
            id: 'override-2',
            originalDate: '2026-03-31',
            newDate: '2026-04-01',
            newTime: '15:00',
            reason: 'Moved',
          },
        ],
      },
    ];

    const second: RecurrenceFormData[] = [
      {
        ...first[0]!,
        exceptions: [...first[0]!.exceptions].reverse(),
        overrides: [...first[0]!.overrides].reverse(),
      },
    ];

    expect(buildSchedulesHashKeyFromFormSchedules(first)).toBe(
      buildSchedulesHashKeyFromFormSchedules(second),
    );
  });
});
