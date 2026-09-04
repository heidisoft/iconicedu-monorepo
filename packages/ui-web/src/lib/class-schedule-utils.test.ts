import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';
import { getScheduleDisplayDateParts } from './schedule-display-timezone';

import {
  expandRecurringEvents,
  getClassScheduleEventsForMonth,
  getClassScheduleEventsForMonthRange,
  getClassScheduleEventsForView,
  getDisplayEventState,
  getEventLayout,
  getHiddenEventOverflowGroups,
} from './class-schedule-utils';

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
  it('groups hidden overflow badges by cluster and hidden start time', () => {
    const events: ClassScheduleVM[] = [
      {
        ...buildRecurringSchedule(),
        endAt: '2026-03-01T18:00:00.000Z',
      },
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-2', orgId: 'org-1' },
        title: 'Session 2',
        endAt: '2026-03-01T18:00:00.000Z',
      },
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-3', orgId: 'org-1' },
        title: 'Session 3',
        endAt: '2026-03-01T18:00:00.000Z',
      },
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-4', orgId: 'org-1' },
        title: 'Session 4',
        startAt: '2026-03-01T16:00:00.000Z',
        endAt: '2026-03-01T18:00:00.000Z',
      },
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-5', orgId: 'org-1' },
        title: 'Session 5',
        startAt: '2026-03-01T16:00:00.000Z',
        endAt: '2026-03-01T18:00:00.000Z',
      },
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-6', orgId: 'org-1' },
        title: 'Session 6',
        startAt: '2026-03-01T17:00:00.000Z',
        endAt: '2026-03-01T18:00:00.000Z',
      },
    ];

    const layout = getEventLayout(events, 'UTC');
    const overflowGroups = getHiddenEventOverflowGroups(events, layout, 3, 'UTC');

    expect(overflowGroups).toHaveLength(2);
    expect(overflowGroups.map((group) => group.startMinutes)).toEqual([960, 1020]);
    expect(
      overflowGroups.map((group) => group.hiddenEvents.map((event) => event.ids.id)),
    ).toEqual([['schedule-4', 'schedule-5'], ['schedule-6']]);
  });

  it('hides recurring class occurrences after the classroom archive cutoff', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: {
        ids: { id: 'recurrence-1', orgId: 'org-1' },
        rule: {
          frequency: 'daily',
          interval: 1,
          count: 4,
        },
      },
      source: {
        kind: 'class_session',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        archivedAt: '2026-03-02T15:00:00.000Z',
        learningSpaceStatus: 'archived',
      },
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-05T00:00:00.000Z'),
    );

    expect(expanded.map((event) => event.startAt)).toEqual([
      '2026-03-01T15:00:00.000Z',
      '2026-03-02T15:00:00.000Z',
    ]);
    expect(expanded.every((event) => event.meetingLink === null)).toBe(true);
    expect(expanded.every((event) => event.uiState?.disabled)).toBe(true);
  });

  it('returns no overflow groups when all columns remain visible', () => {
    const events: ClassScheduleVM[] = [
      buildRecurringSchedule(),
      {
        ...buildRecurringSchedule(),
        ids: { id: 'schedule-2', orgId: 'org-1' },
        title: 'Session 2',
        startAt: '2026-03-01T16:00:00.000Z',
        endAt: '2026-03-01T17:00:00.000Z',
      },
    ];

    const layout = getEventLayout(events, 'UTC');

    expect(getHiddenEventOverflowGroups(events, layout, 3, 'UTC')).toEqual([]);
  });

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

  it('treats cancelled non-recurring sessions as disabled skipped entries', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: undefined,
      status: 'cancelled',
      description: 'Tutor unavailable',
    };

    const expanded = expandRecurringEvents(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-02T00:00:00.000Z'),
    );

    expect(expanded).toHaveLength(1);
    expect(expanded[0]?.uiState?.kind).toBe('exception');
    expect(getDisplayEventState(expanded[0]!).disabled).toBe(true);
    expect(getDisplayEventState(expanded[0]!).reason).toBe('Tutor unavailable');
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

  it('keeps both logical occurrences when one recurrence is moved onto another scheduled day', () => {
    const schedule: ClassScheduleVM = {
      ...buildRecurringSchedule(),
      recurrence: {
        ...buildRecurringSchedule().recurrence!,
        rule: {
          frequency: 'weekly',
          interval: 1,
          count: 4,
          byWeekday: ['SU', 'MO'],
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
      '2026-03-02T15:00:00.000Z',
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

/**
 * Regression coverage for #194: a New York Sunday session disappearing for an
 * Asia/Colombo viewer. Every case here passes the viewer timezone explicitly,
 * so the assertions must hold under any runtime `TZ`.
 */
describe('viewer-timezone calendar ranges', () => {
  const COLOMBO = 'Asia/Colombo';
  const NEW_YORK = 'America/New_York';

  function buildWeeklySchedule(
    overrides: Partial<ClassScheduleVM> & { startAt: string; endAt: string },
    scheduleTimezone = NEW_YORK,
  ): ClassScheduleVM {
    return {
      ids: { id: 'schedule-tz', orgId: 'org-1' },
      title: 'Sunday Session',
      status: 'scheduled',
      visibility: 'private',
      participants: [],
      source: {
        kind: 'class_session',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
      },
      timezone: scheduleTimezone,
      recurrence: {
        ids: { id: 'recurrence-tz', orgId: 'org-1' },
        rule: {
          frequency: 'weekly',
          interval: 1,
          timezone: scheduleTimezone,
          byWeekday: ['SU'],
        },
      },
      audit: { createdAt: '2026-04-01T00:00:00.000Z', createdBy: 'user-1' },
      ...overrides,
    };
  }

  /** New York Sunday 09:30, which is Sunday 19:00 for a Colombo viewer. */
  const newYorkSundayMorning = () =>
    buildWeeklySchedule({
      startAt: '2026-04-12T13:30:00.000Z',
      endAt: '2026-04-12T14:30:00.000Z',
    });

  /** New York Sunday 21:00, which is Monday 06:30 for a Colombo viewer. */
  const newYorkSundayNight = () =>
    buildWeeklySchedule({
      startAt: '2026-04-13T01:00:00.000Z',
      endAt: '2026-04-13T02:00:00.000Z',
    });

  /**
   * Anchors "the day the calendar is showing" at noon in the *viewer*
   * timezone. Building it with `new Date(year, month, day)` would anchor it in
   * the runtime timezone instead, which is the very coupling this suite exists
   * to rule out.
   */
  const viewerNoon = (dayKey: string, timezone: string) =>
    new Date(toUtcFromLocal(dayKey, '12:00', timezone)!);

  // A Wednesday inside the Monday 2026-08-24 -> Sunday 2026-08-30 viewer week.
  const midWeek = () => viewerNoon('2026-08-26', COLOMBO);

  describe('recurring range placement', () => {
    it('keeps a New York Sunday morning on Colombo Sunday inside the viewer week', () => {
      const events = getClassScheduleEventsForView(
        [newYorkSundayMorning()],
        midWeek(),
        'week',
        COLOMBO,
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.startAt).toBe('2026-08-30T13:30:00.000Z');
      expect(getLocalDate(events[0]!.startAt, COLOMBO)).toBe('2026-08-30');
      expect(getLocalTime(events[0]!.startAt, COLOMBO)).toBe('19:00');
      // The same instant is still Sunday morning in the schedule timezone.
      expect(getLocalDate(events[0]!.startAt, NEW_YORK)).toBe('2026-08-30');
      expect(getLocalTime(events[0]!.startAt, NEW_YORK)).toBe('09:30');
    });

    it('places a late New York Sunday on Colombo Monday in the following viewer week', () => {
      const schedule = newYorkSundayNight();

      // Colombo Monday 2026-08-24 belongs to the 08-24 -> 08-30 viewer week.
      const containingWeek = getClassScheduleEventsForView(
        [schedule],
        midWeek(),
        'week',
        COLOMBO,
      );
      expect(containingWeek.map((event) => event.startAt)).toEqual([
        '2026-08-24T01:00:00.000Z',
      ]);
      expect(getLocalDate(containingWeek[0]!.startAt, COLOMBO)).toBe('2026-08-24');
      expect(getLocalDate(containingWeek[0]!.startAt, NEW_YORK)).toBe('2026-08-23');

      // It must not also leak into the preceding viewer week.
      const previousWeek = getClassScheduleEventsForView(
        [schedule],
        viewerNoon('2026-08-19', COLOMBO),
        'week',
        COLOMBO,
      );
      expect(previousWeek.map((event) => event.startAt)).toEqual([
        '2026-08-17T01:00:00.000Z',
      ]);
    });

    it('shows the late New York Sunday only on Colombo Monday in day view', () => {
      const schedule = newYorkSundayNight();

      expect(
        getClassScheduleEventsForView(
          [schedule],
          viewerNoon('2026-08-24', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(1);
      expect(
        getClassScheduleEventsForView(
          [schedule],
          viewerNoon('2026-08-23', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(0);
    });

    it('covers the inverse boundary for a viewer west of the schedule timezone', () => {
      // Colombo Monday 08:00 is still Sunday evening in Los Angeles.
      const schedule = buildWeeklySchedule(
        {
          ids: { id: 'schedule-colombo', orgId: 'org-1' },
          startAt: '2026-04-13T02:30:00.000Z',
          endAt: '2026-04-13T03:30:00.000Z',
          recurrence: {
            ids: { id: 'recurrence-colombo', orgId: 'org-1' },
            rule: {
              frequency: 'weekly',
              interval: 1,
              timezone: COLOMBO,
              byWeekday: ['MO'],
            },
          },
        },
        COLOMBO,
      );

      const events = getClassScheduleEventsForView(
        [schedule],
        viewerNoon('2026-08-19', 'America/Los_Angeles'),
        'week',
        'America/Los_Angeles',
      );

      expect(events).toHaveLength(1);
      expect(getLocalDate(events[0]!.startAt, COLOMBO)).toBe('2026-08-24');
      // Sunday 2026-08-23 in Los Angeles, i.e. the 08-17 -> 08-23 viewer week.
      expect(getLocalDate(events[0]!.startAt, 'America/Los_Angeles')).toBe('2026-08-23');
    });

    it('produces the same occurrence through week, day, month, and month-range helpers', () => {
      const schedule = newYorkSundayMorning();
      const occurrence = '2026-08-30T13:30:00.000Z';

      const week = getClassScheduleEventsForView([schedule], midWeek(), 'week', COLOMBO);
      const day = getClassScheduleEventsForView(
        [schedule],
        viewerNoon('2026-08-30', COLOMBO),
        'day',
        COLOMBO,
      );
      const month = getClassScheduleEventsForMonth([schedule], midWeek(), COLOMBO);
      const monthRange = getClassScheduleEventsForMonthRange(
        [schedule],
        midWeek(),
        1,
        1,
        COLOMBO,
      );

      expect(week.map((event) => event.startAt)).toContain(occurrence);
      expect(day.map((event) => event.startAt)).toEqual([occurrence]);
      expect(month.map((event) => event.startAt)).toContain(occurrence);
      expect(monthRange.map((event) => event.startAt)).toContain(occurrence);

      // Every August Sunday converts to a Colombo Sunday evening.
      expect(month.map((event) => getLocalDate(event.startAt, COLOMBO))).toEqual([
        '2026-08-02',
        '2026-08-09',
        '2026-08-16',
        '2026-08-23',
        '2026-08-30',
      ]);
    });

    it('handles the December/January rollover for a viewer ahead of the schedule', () => {
      // New York Thursday 17:00 is Friday 03:30 in Colombo, crossing the year.
      const schedule = buildWeeklySchedule({
        ids: { id: 'schedule-rollover', orgId: 'org-1' },
        startAt: '2026-12-31T22:00:00.000Z',
        endAt: '2026-12-31T23:00:00.000Z',
        recurrence: {
          ids: { id: 'recurrence-rollover', orgId: 'org-1' },
          rule: {
            frequency: 'weekly',
            interval: 1,
            timezone: NEW_YORK,
            byWeekday: ['TH'],
          },
        },
      });

      const januaryEvents = getClassScheduleEventsForMonth(
        [schedule],
        viewerNoon('2027-01-15', COLOMBO),
        COLOMBO,
      );

      // The New York 2026-12-31 occurrence lands on Colombo 2027-01-01.
      expect(januaryEvents.map((event) => event.startAt)).toContain(
        '2026-12-31T22:00:00.000Z',
      );
      expect(getLocalDate('2026-12-31T22:00:00.000Z', COLOMBO)).toBe('2027-01-01');

      const decemberEvents = getClassScheduleEventsForMonth(
        [schedule],
        viewerNoon('2026-12-15', COLOMBO),
        COLOMBO,
      );
      expect(decemberEvents.map((event) => event.startAt)).not.toContain(
        '2026-12-31T22:00:00.000Z',
      );
    });
  });

  describe('daylight saving transitions', () => {
    const marchSchedule = () =>
      buildWeeklySchedule({
        ids: { id: 'schedule-dst-spring', orgId: 'org-1' },
        startAt: '2026-03-01T14:30:00.000Z',
        endAt: '2026-03-01T15:30:00.000Z',
      });

    const novemberSchedule = () =>
      buildWeeklySchedule({
        ids: { id: 'schedule-dst-fall', orgId: 'org-1' },
        startAt: '2026-10-25T13:30:00.000Z',
        endAt: '2026-10-25T14:30:00.000Z',
      });

    it('preserves New York wall time across spring-forward', () => {
      const events = getClassScheduleEventsForMonth(
        [marchSchedule()],
        viewerNoon('2026-03-15', COLOMBO),
        COLOMBO,
      );

      expect(events.map((event) => getLocalTime(event.startAt, NEW_YORK))).toEqual([
        '09:30',
        '09:30',
        '09:30',
        '09:30',
        '09:30',
      ]);
      // Colombo shifts an hour earlier once New York enters DST on 2026-03-08.
      expect(events.map((event) => getLocalTime(event.startAt, COLOMBO))).toEqual([
        '20:00',
        '19:00',
        '19:00',
        '19:00',
        '19:00',
      ]);
    });

    it('preserves New York wall time across fall-back', () => {
      const events = getClassScheduleEventsForMonth(
        [novemberSchedule()],
        viewerNoon('2026-11-15', COLOMBO),
        COLOMBO,
      );

      expect(events.map((event) => getLocalTime(event.startAt, NEW_YORK))).toEqual([
        '09:30',
        '09:30',
        '09:30',
        '09:30',
        '09:30',
      ]);
      // Colombo shifts an hour later once New York leaves DST on 2026-11-01.
      expect(events.map((event) => getLocalTime(event.startAt, COLOMBO))).toEqual([
        '20:00',
        '20:00',
        '20:00',
        '20:00',
        '20:00',
      ]);
    });

    it('neither duplicates nor omits an occurrence in either transition week', () => {
      const springWeek = getClassScheduleEventsForView(
        [marchSchedule()],
        viewerNoon('2026-03-04', COLOMBO),
        'week',
        COLOMBO,
      );
      expect(springWeek.map((event) => event.startAt)).toEqual([
        '2026-03-08T13:30:00.000Z',
      ]);

      const fallWeek = getClassScheduleEventsForView(
        [novemberSchedule()],
        viewerNoon('2026-10-28', COLOMBO),
        'week',
        COLOMBO,
      );
      expect(fallWeek.map((event) => event.startAt)).toEqual([
        '2026-11-01T14:30:00.000Z',
      ]);
    });
  });

  describe('viewer timezone resolution', () => {
    it('is independent of the runtime timezone when a viewer timezone is given', () => {
      const schedule = newYorkSundayMorning();
      // `midWeek()` is a runtime-local Date, so this asserts that the result is
      // driven by the explicit viewer timezone rather than the host clock.
      const colombo = getClassScheduleEventsForView(
        [schedule],
        midWeek(),
        'week',
        COLOMBO,
      );
      const newYork = getClassScheduleEventsForView(
        [schedule],
        midWeek(),
        'week',
        NEW_YORK,
      );
      const utc = getClassScheduleEventsForView([schedule], midWeek(), 'week', 'UTC');

      expect(colombo.map((event) => event.startAt)).toEqual(['2026-08-30T13:30:00.000Z']);
      expect(newYork.map((event) => event.startAt)).toEqual(['2026-08-30T13:30:00.000Z']);
      expect(utc.map((event) => event.startAt)).toEqual(['2026-08-30T13:30:00.000Z']);
    });

    it('falls back without dropping occurrences when the viewer timezone is invalid', () => {
      const schedule = newYorkSundayMorning();
      // An invalid viewer timezone resolves through the documented fallback
      // chain, which ends at the runtime timezone under jsdom. A month range is
      // asserted rather than a single day because the fallback can legitimately
      // shift an occurrence's viewer date by one day; what must not happen is an
      // occurrence going missing.
      const augustSundays = [
        '2026-08-02T13:30:00.000Z',
        '2026-08-09T13:30:00.000Z',
        '2026-08-16T13:30:00.000Z',
        '2026-08-23T13:30:00.000Z',
        '2026-08-30T13:30:00.000Z',
      ];

      for (const invalid of [null, undefined, '', '   ', 'Not/AZone']) {
        const events = getClassScheduleEventsForMonth(
          [schedule],
          new Date('2026-08-15T12:00:00.000Z'),
          invalid,
        );
        expect(events.map((event) => event.startAt)).toEqual(augustSundays);
      }
    });
  });

  describe('non-recurring sessions near a viewer date boundary', () => {
    function buildOneOff(startAt: string, endAt: string, id: string): ClassScheduleVM {
      return {
        ids: { id, orgId: 'org-1' },
        title: 'One-off',
        startAt,
        endAt,
        status: 'scheduled',
        visibility: 'private',
        participants: [],
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
        },
        timezone: NEW_YORK,
        audit: { createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'user-1' },
      };
    }

    it('places a session on the viewer date rather than the schedule date', () => {
      // New York Sunday 21:00 -> Colombo Monday 06:30.
      const session = buildOneOff(
        '2026-08-31T01:00:00.000Z',
        '2026-08-31T02:00:00.000Z',
        'one-off-late',
      );

      expect(
        getClassScheduleEventsForView(
          [session],
          viewerNoon('2026-08-31', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(1);
      expect(
        getClassScheduleEventsForView(
          [session],
          viewerNoon('2026-08-30', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(0);
      // The same session sits on 2026-08-30 for a New York viewer.
      expect(
        getClassScheduleEventsForView(
          [session],
          viewerNoon('2026-08-30', NEW_YORK),
          'day',
          NEW_YORK,
        ),
      ).toHaveLength(1);
    });

    it('keeps an exact viewer-midnight session on its own date', () => {
      // 2026-08-29T18:30Z is exactly Colombo 2026-08-30T00:00.
      const session = buildOneOff(
        '2026-08-29T18:30:00.000Z',
        '2026-08-29T19:30:00.000Z',
        'one-off-midnight',
      );

      expect(
        getClassScheduleEventsForView(
          [session],
          viewerNoon('2026-08-30', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(1);
      expect(
        getClassScheduleEventsForView(
          [session],
          viewerNoon('2026-08-31', COLOMBO),
          'day',
          COLOMBO,
        ),
      ).toHaveLength(0);
    });
  });

  describe('exceptions and overrides across a viewer boundary', () => {
    it('suppresses the viewer-local occurrence for a schedule-timezone cancellation key', () => {
      const schedule = newYorkSundayMorning();
      const cancelled: ClassScheduleVM = {
        ...schedule,
        recurrence: {
          ...schedule.recurrence!,
          exceptions: [
            { occurrenceKey: '2026-08-30T13:30:00.000Z', reason: 'Public holiday' },
          ],
        },
      };

      const events = getClassScheduleEventsForView(
        [cancelled],
        midWeek(),
        'week',
        COLOMBO,
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.status).toBe('cancelled');
      expect(getDisplayEventState(events[0]!).kind).toBe('exception');
      expect(getLocalDate(events[0]!.startAt, COLOMBO)).toBe('2026-08-30');
    });

    it('shows a rescheduled occurrence exactly once when it crosses a viewer day', () => {
      const schedule = newYorkSundayMorning();
      const moved: ClassScheduleVM = {
        ...schedule,
        recurrence: {
          ...schedule.recurrence!,
          overrides: [
            {
              occurrenceKey: '2026-08-30T13:30:00.000Z',
              patch: {
                // New York Sunday 21:00 -> Colombo Monday 2026-08-31 06:30.
                startAt: '2026-08-31T01:00:00.000Z',
                endAt: '2026-08-31T02:00:00.000Z',
              },
            },
          ],
        },
      };

      const viewerWeek = getClassScheduleEventsForView(
        [moved],
        midWeek(),
        'week',
        COLOMBO,
      );
      // The occurrence moved out of the Colombo 08-24 -> 08-30 week entirely.
      expect(viewerWeek).toHaveLength(0);

      const nextWeek = getClassScheduleEventsForView(
        [moved],
        viewerNoon('2026-09-02', COLOMBO),
        'week',
        COLOMBO,
      );
      const movedOccurrences = nextWeek.filter(
        (event) => event.startAt === '2026-08-31T01:00:00.000Z',
      );
      expect(movedOccurrences).toHaveLength(1);
      expect(getDisplayEventState(movedOccurrences[0]!).kind).toBe('override');
    });
  });

  describe('authorization', () => {
    it('does not add or remove schedules the caller was not given', () => {
      const schedule = newYorkSundayMorning();
      const events = getClassScheduleEventsForView([], midWeek(), 'week', COLOMBO);

      // Expansion only ever derives occurrences from the supplied schedules;
      // participant/profile filtering stays with the caller.
      expect(events).toEqual([]);
      expect(
        getClassScheduleEventsForView([schedule], midWeek(), 'week', COLOMBO).every(
          (event) => event.ids.id.startsWith(schedule.ids.id),
        ),
      ).toBe(true);
    });
  });

  /**
   * Regression coverage for the review finding on #194.
   *
   * `ClassScheduleClient`, the Today action, and mini-calendar navigation all
   * supply `currentDate` as a *display date*: a runtime-local `Date` whose
   * fields already represent the selected viewer day, built by
   * `toScheduleDisplayDate`. Re-converting that value through the viewer
   * timezone shifts it by a day whenever the browser is ahead of the profile,
   * which dropped the selected day's sessions from day view and moved the
   * week/month ranges across a boundary.
   *
   * These cases construct `currentDate` exactly the way the callers do.
   */
  describe('range helpers accept caller display dates', () => {
    /** Mirrors `toScheduleDisplayDate(instant, viewerTimezone)`. */
    const asDisplayDate = (instant: string, timezone: string) => {
      const parts = getScheduleDisplayDateParts(instant, timezone)!;
      return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    };

    // 2026-08-27T07:00Z is 03:00 on Aug 27 in New York and 12:30 the same day
    // in Colombo, so a New York viewer's display date reads Aug 27 03:00. Its
    // underlying instant, read back as New York, is Aug 26 — the shift.
    const newYorkEarlyMorning = '2026-08-27T07:00:00.000Z';

    const thursdaySession = (): ClassScheduleVM => ({
      ids: { id: 'schedule-display-date', orgId: 'org-1' },
      title: 'Thursday session',
      // New York Thursday 2026-08-27 10:00.
      startAt: '2026-08-27T14:00:00.000Z',
      endAt: '2026-08-27T15:00:00.000Z',
      status: 'scheduled',
      visibility: 'private',
      participants: [],
      source: {
        kind: 'class_session',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
      },
      timezone: NEW_YORK,
      audit: { createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'user-1' },
    });

    it('keeps the selected day in day view', () => {
      const currentDate = asDisplayDate(newYorkEarlyMorning, NEW_YORK);
      expect(currentDate.getDate()).toBe(27);

      const events = getClassScheduleEventsForView(
        [thursdaySession()],
        currentDate,
        'day',
        NEW_YORK,
      );

      expect(events.map((event) => event.startAt)).toEqual(['2026-08-27T14:00:00.000Z']);
    });

    it('keeps the selected day inside the week range', () => {
      const events = getClassScheduleEventsForView(
        [thursdaySession()],
        asDisplayDate(newYorkEarlyMorning, NEW_YORK),
        'week',
        NEW_YORK,
      );

      expect(events.map((event) => event.startAt)).toEqual(['2026-08-27T14:00:00.000Z']);
    });

    it('keeps the selected day inside the month and month-range helpers', () => {
      const currentDate = asDisplayDate(newYorkEarlyMorning, NEW_YORK);

      expect(
        getClassScheduleEventsForMonth([thursdaySession()], currentDate, NEW_YORK).map(
          (event) => event.startAt,
        ),
      ).toEqual(['2026-08-27T14:00:00.000Z']);

      expect(
        getClassScheduleEventsForMonthRange(
          [thursdaySession()],
          currentDate,
          1,
          1,
          NEW_YORK,
        ).map((event) => event.startAt),
      ).toEqual(['2026-08-27T14:00:00.000Z']);
    });

    it('does not shift a month boundary selected on the first of the month', () => {
      // New York 2026-09-01 01:00 — an early-hours display date on a month edge.
      const currentDate = asDisplayDate('2026-09-01T05:00:00.000Z', NEW_YORK);
      expect(currentDate.getMonth()).toBe(8);
      expect(currentDate.getDate()).toBe(1);

      const septemberSession: ClassScheduleVM = {
        ...thursdaySession(),
        ids: { id: 'schedule-september', orgId: 'org-1' },
        startAt: '2026-09-03T14:00:00.000Z',
        endAt: '2026-09-03T15:00:00.000Z',
      };

      expect(
        getClassScheduleEventsForMonth([septemberSession], currentDate, NEW_YORK).map(
          (event) => event.startAt,
        ),
      ).toEqual(['2026-09-03T14:00:00.000Z']);
    });
  });
});
