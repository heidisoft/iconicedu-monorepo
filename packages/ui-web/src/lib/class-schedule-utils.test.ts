import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { getLocalTime } from '@iconicedu/utils';

import { expandRecurringEvents, getDisplayEventState } from './class-schedule-utils';

function buildRecurringSchedule(): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Session',
    startAt: '2026-03-01T15:00:00.000Z',
    endAt: '2026-03-01T16:00:00.000Z',
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    recurrence: {
      ids: { id: 'recurrence-1', orgId: 'org-1' },
      rule: {
        frequency: 'daily',
        interval: 1,
        count: 2,
      },
      overrides: [
        {
          occurrenceKey: '2026-03-02T10:00:00.000Z',
          patch: {
            startAt: '2026-03-03T17:00:00.000Z',
            endAt: '2026-03-03T18:00:00.000Z',
          },
        },
      ],
    },
    audit: { createdAt: '2026-03-01T00:00:00.000Z', createdBy: 'user-1' },
  };
}

describe('class-schedule-utils', () => {
  it('matches overrides by occurrence day when timestamp keys differ', () => {
    const expanded = expandRecurringEvents(
      [buildRecurringSchedule()],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-04T00:00:00.000Z'),
    );

    expect(expanded.map((item) => item.startAt)).toContain('2026-03-03T17:00:00.000Z');
  });

  it('keeps exceptions visible as disabled entries with the provided reason', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: {
        ...buildRecurringSchedule().recurrence!,
        overrides: [],
        exceptions: [
          {
            occurrenceKey: '2026-03-02T15:00:00.000Z',
            reason: 'Spring holiday',
          },
        ],
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-03T00:00:00.000Z'),
    );

    const exception = expanded.find((item) => item.uiState?.kind === 'exception');
    expect(exception?.status).toBe('cancelled');
    expect(getDisplayEventState(exception!).disabled).toBe(true);
    expect(getDisplayEventState(exception!).reason).toBe('Spring holiday');
  });

  it('marks override occurrences as changed and preserves original timing metadata', () => {
    const expanded = expandRecurringEvents(
      [buildRecurringSchedule()],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-04T00:00:00.000Z'),
    );

    const override = expanded.find((item) => item.uiState?.kind === 'override');
    const displayState = getDisplayEventState(override!);

    expect(override?.status).toBe('rescheduled');
    expect(displayState.originalStartAt).toBe('2026-03-02T15:00:00.000Z');
    expect(displayState.originalEndAt).toBe('2026-03-02T16:00:00.000Z');
  });

  it('dedupes day collisions so an override replaces the default occurrence on that day', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: {
        ...buildRecurringSchedule().recurrence!,
        rule: {
          frequency: 'daily',
          interval: 1,
          count: 3,
        },
        overrides: [
          {
            occurrenceKey: '2026-03-01T15:00:00.000Z',
            patch: {
              startAt: '2026-03-02T17:00:00.000Z',
              endAt: '2026-03-02T18:00:00.000Z',
            },
          },
        ],
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-03T23:59:59.000Z'),
    );

    expect(expanded.map((item) => item.startAt)).toEqual([
      '2026-03-02T17:00:00.000Z',
      '2026-03-03T15:00:00.000Z',
    ]);
  });

  it('includes an override when the moved occurrence date is in range but the original date is not', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: {
        ...buildRecurringSchedule().recurrence!,
        rule: {
          frequency: 'daily',
          interval: 1,
          count: 3,
        },
        overrides: [
          {
            occurrenceKey: '2026-03-01T15:00:00.000Z',
            patch: {
              startAt: '2026-03-05T17:00:00.000Z',
              endAt: '2026-03-05T18:00:00.000Z',
            },
          },
        ],
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-05T00:00:00.000Z'),
      new Date('2026-03-05T23:59:59.000Z'),
    );

    expect(expanded).toHaveLength(1);
    expect(expanded[0]?.startAt).toBe('2026-03-05T17:00:00.000Z');
    expect(expanded[0]?.uiState?.kind).toBe('override');
  });

  it('keeps weekly recurring sessions anchored to the class timezone across DST', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      startAt: '2026-03-01T21:00:00.000Z',
      endAt: '2026-03-01T22:00:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        ids: { id: 'recurrence-weekly-1', orgId: 'org-1' },
        rule: {
          frequency: 'weekly',
          interval: 1,
          count: 3,
          timezone: 'America/New_York',
          byWeekday: ['SU'],
        },
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-16T00:00:00.000Z'),
    );

    expect(expanded.map((item) => item.startAt)).toEqual([
      '2026-03-01T21:00:00.000Z',
      '2026-03-08T20:00:00.000Z',
      '2026-03-15T20:00:00.000Z',
    ]);
    expect(
      expanded.map((item) => getLocalTime(item.startAt, 'America/New_York')),
    ).toEqual(['16:00', '16:00', '16:00']);
  });

  it('shifts tutor-local time in non-DST regions when the class timezone stays fixed', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      startAt: '2026-03-01T21:00:00.000Z',
      endAt: '2026-03-01T22:00:00.000Z',
      timezone: 'America/New_York',
      recurrence: {
        ids: { id: 'recurrence-weekly-2', orgId: 'org-1' },
        rule: {
          frequency: 'weekly',
          interval: 1,
          count: 2,
          timezone: 'America/New_York',
          byWeekday: ['SU'],
        },
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-09T23:59:59.000Z'),
    );

    expect(expanded.map((item) => getLocalTime(item.startAt, 'Asia/Colombo'))).toEqual([
      '02:30',
      '01:30',
    ]);
  });
});
