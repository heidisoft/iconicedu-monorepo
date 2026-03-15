import { describe, expect, it } from 'vitest';

import {
  buildRRuleFields,
  buildScheduleStart,
  getDateFromISOInTimezone,
  getTimeFromISOInTimezone,
  normalizeScheduleFormDate,
  buildLearningSpaceScheduleHashBundleFromExisting,
  buildLearningSpaceScheduleHashBundleFromPayload,
  buildLearningSpaceSchedulesHashKeyFromPayload,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';

describe('class schedule hash', () => {
  it('builds schedule start using schedule timezone local date and time', () => {
    const expanded = buildScheduleStart({
      startDate: '2026-03-10T00:00:00.000Z',
      startTime: '14:00',
      endTime: '15:00',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '14:00' }],
      },
      exceptions: [],
      overrides: [],
    });

    expect(getDateFromISOInTimezone(expanded.startAt, 'America/New_York')).toBe(
      '2026-03-10',
    );
    expect(getTimeFromISOInTimezone(expanded.startAt, 'America/New_York')).toBe('14:00');
    expect(getTimeFromISOInTimezone(expanded.endAt, 'America/New_York')).toBe('15:00');
  });

  it('handles overnight end times in schedule timezone', () => {
    const expanded = buildScheduleStart({
      startDate: '2026-03-10T00:00:00.000Z',
      startTime: '23:30',
      endTime: '00:30',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '23:30' }],
      },
      exceptions: [],
      overrides: [],
    });

    expect(getDateFromISOInTimezone(expanded.startAt, 'America/New_York')).toBe(
      '2026-03-10',
    );
    expect(getTimeFromISOInTimezone(expanded.startAt, 'America/New_York')).toBe('23:30');
    expect(getDateFromISOInTimezone(expanded.endAt, 'America/New_York')).toBe(
      '2026-03-11',
    );
    expect(getTimeFromISOInTimezone(expanded.endAt, 'America/New_York')).toBe('00:30');
  });

  it('handles DST-aware conversion using the selected schedule timezone', () => {
    const expanded = buildScheduleStart({
      startDate: '2026-03-08T12:00:00.000Z',
      startTime: '09:00',
      endTime: '10:00',
      timezone: 'America/New_York',
      exceptions: [],
      overrides: [],
    });

    expect(expanded.startAt).toBe('2026-03-08T13:00:00.000Z');
    expect(expanded.endAt).toBe('2026-03-08T14:00:00.000Z');
    expect(getTimeFromISOInTimezone(expanded.startAt, 'America/New_York')).toBe('09:00');
  });

  it('builds recurrence time fields using schedule timezone for non-weekly rules', () => {
    const fields = buildRRuleFields(
      {
        frequency: 'daily',
        weekdayTimes: [{ day: 'TU', time: '16:45' }],
      },
      '2026-03-10T18:30:00.000Z',
      'America/New_York',
    );

    expect(fields.byhour).toEqual([16]);
    expect(fields.byminute).toEqual([45]);
    expect(fields.byday).toBeNull();
  });

  it('keeps the same hash for equivalent weekly payloads with different anchor dates', () => {
    const first = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T00:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['SA'],
        weekdayTimes: [{ day: 'SA', time: '14:00' }],
      },
      exceptions: [],
      overrides: [],
    });

    const second = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-14T00:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['SA'],
        weekdayTimes: [{ day: 'SA', time: '14:00' }],
      },
      exceptions: [],
      overrides: [],
    });

    expect(first.baseHash).toBe(second.baseHash);
    expect(first.fullHash).toBe(second.fullHash);
  });

  it('changes the full hash when overrides or exceptions change', () => {
    const baseline = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T00:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '14:00' }],
      },
      exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
      overrides: [],
    });

    const changed = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T00:00:00.000Z',
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
    });

    expect(changed.baseHash).toBe(baseline.baseHash);
    expect(changed.fullHash).not.toBe(baseline.fullHash);
  });

  it('changes schedules hash key when schedule end time changes', () => {
    const baseline = buildLearningSpaceSchedulesHashKeyFromPayload([
      {
        startDate: '2026-03-10T00:00:00.000Z',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [],
        overrides: [],
      },
    ]);

    const changed = buildLearningSpaceSchedulesHashKeyFromPayload([
      {
        startDate: '2026-03-10T00:00:00.000Z',
        startTime: '14:00',
        endTime: '16:00',
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [],
        overrides: [],
      },
    ]);

    expect(changed).not.toBe(baseline);
  });

  it('normalizes form dates from ISO strings using the schedule timezone date', () => {
    expect(
      normalizeScheduleFormDate(
        '2026-03-10T01:30:00.000Z',
        'America/Los_Angeles',
      )?.toISOString(),
    ).toBe('2026-03-09T12:00:00.000Z');
  });

  it('treats reordered exception and override lists as the same schedule', () => {
    const first = buildLearningSpaceSchedulesHashKeyFromPayload([
      {
        startDate: '2026-03-10T00:00:00.000Z',
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [
          { date: '2026-03-24', reason: 'Break' },
          { date: '2026-03-17', reason: 'Holiday' },
        ],
        overrides: [
          {
            originalDate: '2026-03-31',
            newDate: '2026-04-01',
            newTime: '15:00',
            reason: 'Moved',
          },
          {
            originalDate: '2026-04-07',
            newDate: '2026-04-08',
            newTime: '15:30',
            reason: 'Moved again',
          },
        ],
      },
    ]);

    const second = buildLearningSpaceSchedulesHashKeyFromPayload([
      {
        startDate: '2026-03-10T00:00:00.000Z',
        timezone: 'UTC',
        rule: {
          frequency: 'weekly',
          byWeekday: ['TU'],
          weekdayTimes: [{ day: 'TU', time: '14:00' }],
        },
        exceptions: [
          { date: '2026-03-17', reason: 'Holiday' },
          { date: '2026-03-24', reason: 'Break' },
        ],
        overrides: [
          {
            originalDate: '2026-04-07',
            newDate: '2026-04-08',
            newTime: '15:30',
            reason: 'Moved again',
          },
          {
            originalDate: '2026-03-31',
            newDate: '2026-04-01',
            newTime: '15:00',
            reason: 'Moved',
          },
        ],
      },
    ]);

    expect(first).toBe(second);
  });

  it('matches saved recurrence rows against equivalent payload schedules', () => {
    const existing = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-14T14:00:00.000Z',
      endAt: '2026-03-14T15:00:00.000Z',
      timezone: 'UTC',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'UTC',
        byday: ['SA'],
        byhour: [14],
        byminute: [0],
        wkst: 'MO',
      },
      exceptions: [],
      overrides: [],
    });

    const incoming = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T00:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['SA'],
        weekdayTimes: [{ day: 'SA', time: '14:00' }],
      },
      exceptions: [],
      overrides: [],
    });

    expect(existing.baseHash).toBe(incoming.baseHash);
    expect(existing.fullHash).toBe(incoming.fullHash);
  });

  it('uses the schedule primary time when a payload override omits newTime', () => {
    const existing = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-11T14:00:00.000Z',
      endAt: '2026-03-11T15:00:00.000Z',
      timezone: 'UTC',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'UTC',
        byday: ['WE'],
        byhour: [14],
        byminute: [0],
        wkst: 'MO',
      },
      exceptions: [],
      overrides: [
        {
          occurrenceKey: '2026-03-18T14:00:00.000Z',
          startAt: '2026-03-25T14:00:00.000Z',
          endAt: '2026-03-25T15:00:00.000Z',
          reason: 'Shifted one week',
        },
      ],
    });

    const incoming = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-11T14:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['WE'],
        weekdayTimes: [{ day: 'WE', time: '14:00' }],
      },
      exceptions: [],
      overrides: [
        {
          originalDate: '2026-03-18',
          newDate: '2026-03-25',
          reason: 'Shifted one week',
        },
      ],
    });

    expect(existing.fullHash).toBe(incoming.fullHash);
  });

  it('matches saved timezone-backed exceptions and overrides against equivalent payload schedules', () => {
    const existing = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      exceptions: [
        {
          occurrenceKey: '2026-03-17T21:02:00.000Z',
          reason: 'Holiday',
        },
      ],
      overrides: [
        {
          occurrenceKey: '2026-03-24T21:02:00.000Z',
          startAt: '2026-03-25T22:15:00.000Z',
          endAt: '2026-03-25T23:15:00.000Z',
          reason: 'Rescheduled',
        },
      ],
    });

    const incoming = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T12:00:00.000Z',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '17:02' }],
        timezone: 'America/New_York',
      },
      exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
      overrides: [
        {
          originalDate: '2026-03-24',
          newDate: '2026-03-25',
          newTime: '18:15',
          reason: 'Rescheduled',
        },
      ],
    });

    expect(existing.baseHash).toBe(incoming.baseHash);
    expect(existing.fullHash).toBe(incoming.fullHash);
  });

  it('recreates the existing full hash when saved exceptions or overrides change', () => {
    const baseline = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      exceptions: [
        {
          occurrenceKey: '2026-03-17T21:02:00.000Z',
          reason: 'Holiday',
        },
      ],
      overrides: [
        {
          occurrenceKey: '2026-03-24T21:02:00.000Z',
          startAt: '2026-03-25T22:15:00.000Z',
          endAt: '2026-03-25T23:15:00.000Z',
          reason: 'Rescheduled',
        },
      ],
    });

    const changed = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      exceptions: [
        {
          occurrenceKey: '2026-03-31T21:02:00.000Z',
          reason: 'Break',
        },
      ],
      overrides: [
        {
          occurrenceKey: '2026-03-24T21:02:00.000Z',
          startAt: '2026-03-25T22:15:00.000Z',
          endAt: '2026-03-25T23:15:00.000Z',
          reason: 'Rescheduled',
        },
      ],
    });

    expect(changed.baseHash).toBe(baseline.baseHash);
    expect(changed.fullHash).not.toBe(baseline.fullHash);
  });

  it('normalizes legacy exception and override timestamps in the same timezone', () => {
    const existing = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      // Legacy UTC-naive timestamps representing local dates/times.
      exceptions: [{ occurrenceKey: '2026-03-17T17:02:00.000Z', reason: 'Holiday' }],
      overrides: [
        {
          occurrenceKey: '2026-03-24T17:02:00.000Z',
          startAt: '2026-03-25T22:15:00.000Z',
          endAt: '2026-03-25T23:15:00.000Z',
          reason: 'Rescheduled',
        },
      ],
    });

    const incoming = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T12:00:00.000Z',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '17:02' }],
        timezone: 'America/New_York',
      },
      exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
      overrides: [
        {
          originalDate: '2026-03-24',
          newDate: '2026-03-25',
          newTime: '18:15',
          reason: 'Rescheduled',
        },
      ],
    });

    expect(existing.baseHash).toBe(incoming.baseHash);
    expect(existing.fullHash).toBe(incoming.fullHash);
  });

  it('treats empty override time and blank reasons as omitted values', () => {
    const first = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-11T14:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['WE'],
        weekdayTimes: [{ day: 'WE', time: '14:00' }],
      },
      exceptions: [{ date: '2026-03-18', reason: '   ' }],
      overrides: [
        {
          originalDate: '2026-03-25',
          newDate: '2026-04-01',
          newTime: '',
          reason: '',
        },
      ],
    });

    const second = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-11T14:00:00.000Z',
      timezone: 'UTC',
      rule: {
        frequency: 'weekly',
        byWeekday: ['WE'],
        weekdayTimes: [{ day: 'WE', time: '14:00' }],
      },
      exceptions: [{ date: '2026-03-18' }],
      overrides: [
        {
          originalDate: '2026-03-25',
          newDate: '2026-04-01',
        },
      ],
    });

    expect(first.baseHash).toBe(second.baseHash);
    expect(first.fullHash).toBe(second.fullHash);
  });

  it('ignores seconds-level timestamp drift in existing exception and override rows', () => {
    const first = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      exceptions: [{ occurrenceKey: '2026-03-17T21:02:17.999Z', reason: 'Holiday' }],
      overrides: [
        {
          occurrenceKey: '2026-03-24T21:02:47.125Z',
          startAt: '2026-03-25T22:15:45.900Z',
          endAt: '2026-03-25T23:15:45.900Z',
          reason: 'Rescheduled',
        },
      ],
    });

    const second = buildLearningSpaceScheduleHashBundleFromExisting({
      id: 'schedule-1',
      startAt: '2026-03-10T21:02:00.000Z',
      endAt: '2026-03-10T22:02:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/New_York',
        byday: ['TU'],
        byhour: [17],
        byminute: [2],
        wkst: 'MO',
      },
      exceptions: [{ occurrenceKey: '2026-03-17T21:02:00.000Z', reason: 'Holiday' }],
      overrides: [
        {
          occurrenceKey: '2026-03-24T21:02:00.000Z',
          startAt: '2026-03-25T22:15:00.000Z',
          endAt: '2026-03-25T23:15:00.000Z',
          reason: 'Rescheduled',
        },
      ],
    });

    expect(first.baseHash).toBe(second.baseHash);
    expect(first.fullHash).toBe(second.fullHash);
  });

  it('changes full hash when meaningful exception date or override time changes', () => {
    const baseline = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T12:00:00.000Z',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '17:02' }],
        timezone: 'America/New_York',
      },
      exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
      overrides: [
        {
          originalDate: '2026-03-24',
          newDate: '2026-03-25',
          newTime: '18:15',
          reason: 'Rescheduled',
        },
      ],
    });

    const changedExceptionDate = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T12:00:00.000Z',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '17:02' }],
        timezone: 'America/New_York',
      },
      exceptions: [{ date: '2026-03-18', reason: 'Holiday' }],
      overrides: [
        {
          originalDate: '2026-03-24',
          newDate: '2026-03-25',
          newTime: '18:15',
          reason: 'Rescheduled',
        },
      ],
    });

    const changedOverrideTime = buildLearningSpaceScheduleHashBundleFromPayload({
      startDate: '2026-03-10T12:00:00.000Z',
      timezone: 'America/New_York',
      rule: {
        frequency: 'weekly',
        byWeekday: ['TU'],
        weekdayTimes: [{ day: 'TU', time: '17:02' }],
        timezone: 'America/New_York',
      },
      exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
      overrides: [
        {
          originalDate: '2026-03-24',
          newDate: '2026-03-25',
          newTime: '18:30',
          reason: 'Rescheduled',
        },
      ],
    });

    expect(changedExceptionDate.baseHash).toBe(baseline.baseHash);
    expect(changedExceptionDate.fullHash).not.toBe(baseline.fullHash);
    expect(changedOverrideTime.baseHash).toBe(baseline.baseHash);
    expect(changedOverrideTime.fullHash).not.toBe(baseline.fullHash);
  });
});
