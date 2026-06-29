import { describe, expect, it } from 'vitest';

import {
  getUpcomingRecurrenceDates,
  isRecurrenceDate,
  upsertPendingException,
  upsertPendingOverride,
} from './recurrence-form.utils';

describe('recurrence-form utils', () => {
  it('returns future weekly recurrence dates for selected weekdays', () => {
    expect(
      getUpcomingRecurrenceDates({
        startDate: new Date('2026-03-02T09:00:00.000Z'),
        frequency: 'weekly',
        byWeekday: ['MO', 'WE'],
        fromDate: new Date('2026-03-08T00:00:00.000Z'),
        maxResults: 5,
      }),
    ).toEqual(['2026-03-09', '2026-03-11', '2026-03-16', '2026-03-18', '2026-03-23']);
  });

  it('respects recurrence interval and count limits', () => {
    expect(
      getUpcomingRecurrenceDates({
        startDate: new Date('2026-03-01T09:00:00.000Z'),
        frequency: 'daily',
        interval: 2,
        count: 4,
        fromDate: new Date('2026-03-01T00:00:00.000Z'),
        maxResults: 10,
      }),
    ).toEqual(['2026-03-01', '2026-03-03', '2026-03-05', '2026-03-07']);
  });

  it('filters past dates while preserving an included editing date', () => {
    expect(
      getUpcomingRecurrenceDates({
        startDate: new Date('2026-03-01T09:00:00.000Z'),
        frequency: 'weekly',
        byWeekday: ['SU'],
        fromDate: new Date('2026-03-15T00:00:00.000Z'),
        maxResults: 3,
        includeDates: ['2026-03-08'],
      }),
    ).toEqual(['2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29']);
  });

  it('stops at until date for monthly recurrence', () => {
    expect(
      getUpcomingRecurrenceDates({
        startDate: new Date('2026-01-10T09:00:00.000Z'),
        frequency: 'monthly',
        until: '2026-04-10T00:00:00.000Z',
        fromDate: new Date('2026-01-01T00:00:00.000Z'),
        maxResults: 12,
      }),
    ).toEqual(['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10']);
  });

  it('allows past dates that are valid recurrence occurrences', () => {
    expect(
      isRecurrenceDate({
        date: new Date('2026-03-09T09:00:00.000Z'),
        startDate: new Date('2026-03-02T09:00:00.000Z'),
        frequency: 'weekly',
        byWeekday: ['MO', 'WE'],
      }),
    ).toBe(true);
  });

  it('rejects dates before the recurrence start', () => {
    expect(
      isRecurrenceDate({
        date: new Date('2026-02-23T09:00:00.000Z'),
        startDate: new Date('2026-03-02T09:00:00.000Z'),
        frequency: 'weekly',
        byWeekday: ['MO'],
      }),
    ).toBe(false);
  });

  it('adds a pending exception on submit when it was selected but not explicitly added', () => {
    const result = upsertPendingException({
      exceptions: [],
      pendingDate: new Date('2026-03-16T09:00:00.000Z'),
      pendingReason: 'Holiday',
      allowedDates: ['2026-03-16'],
    });

    expect(result).toEqual([
      {
        id: expect.any(String),
        date: '2026-03-16',
        reason: 'Holiday',
      },
    ]);
  });

  it('updates the edited exception when pending exception state exists on submit', () => {
    const result = upsertPendingException({
      exceptions: [{ id: 'exception-1', date: '2026-03-09', reason: 'Old' }],
      editingExceptionId: 'exception-1',
      pendingDate: new Date('2026-03-16T09:00:00.000Z'),
      pendingReason: 'Moved',
      allowedDates: ['2026-03-16'],
    });

    expect(result).toEqual([
      {
        id: 'exception-1',
        date: '2026-03-16',
        reason: 'Moved',
      },
    ]);
  });

  it('adds a pending override on submit when it was selected but not explicitly added', () => {
    const result = upsertPendingOverride({
      overrides: [],
      pendingOriginalDate: new Date('2026-03-16T09:00:00.000Z'),
      pendingNewDate: new Date('2026-03-17T09:00:00.000Z'),
      pendingNewTime: '10:30',
      pendingReason: 'Rescheduled',
      allowedOriginalDates: ['2026-03-16'],
    });

    expect(result).toEqual([
      {
        id: expect.any(String),
        originalDate: '2026-03-16',
        newDate: '2026-03-17',
        newTime: '10:30',
        reason: 'Rescheduled',
      },
    ]);
  });

  it('updates the edited override when pending override state exists on submit', () => {
    const result = upsertPendingOverride({
      overrides: [
        {
          id: 'override-1',
          originalDate: '2026-03-09',
          newDate: '2026-03-10',
          reason: 'Old',
        },
      ],
      editingOverrideId: 'override-1',
      pendingOriginalDate: new Date('2026-03-16T09:00:00.000Z'),
      pendingNewDate: new Date('2026-03-18T09:00:00.000Z'),
      pendingNewTime: '11:00',
      pendingReason: 'Moved',
      allowedOriginalDates: ['2026-03-16'],
    });

    expect(result).toEqual([
      {
        id: 'override-1',
        originalDate: '2026-03-16',
        newDate: '2026-03-18',
        newTime: '11:00',
        reason: 'Moved',
      },
    ]);
  });
});
