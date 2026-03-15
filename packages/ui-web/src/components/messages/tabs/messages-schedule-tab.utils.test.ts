import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import {
  calculateScheduleCompletionPercent,
  createGoogleCalendarUrl,
  formatScheduleDateBadge,
  formatScheduleDateTime,
  formatScheduleDayTimeMeta,
  getMonthProgressStatsByKey,
  getJoinableSessionId,
  getScheduleMonthKey,
  groupSchedulesByMonth,
  formatScheduleStatus,
  formatScheduleWeekTitle,
  splitSchedulesByTimeline,
  takeMonthGroups,
  toMonthGroups,
} from './messages-schedule-tab.utils';

function buildSchedule(id: string, startAt: string): ClassScheduleVM {
  return {
    ids: { id, orgId: 'org-1' },
    title: `Event ${id}`,
    startAt,
    endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    audit: { createdAt: startAt, createdBy: 'user-1' },
  };
}

describe('messages-schedule-tab.utils', () => {
  it('splits and sorts schedules into upcoming and past buckets', () => {
    const now = new Date('2026-03-01T10:00:00.000Z');
    const schedules = [
      buildSchedule('1', '2026-03-01T11:00:00.000Z'),
      buildSchedule('2', '2026-03-01T09:00:00.000Z'),
      buildSchedule('3', '2026-03-02T09:00:00.000Z'),
      buildSchedule('4', '2026-02-28T09:00:00.000Z'),
    ];

    const { upcoming, past } = splitSchedulesByTimeline(schedules, now);
    expect(upcoming.map((item) => item.ids.id)).toEqual(['2', '1', '3']);
    expect(past.map((item) => item.ids.id)).toEqual(['4']);
  });

  it('keeps a session upcoming until its end time passes', () => {
    const schedule = buildSchedule('active-1', '2026-03-01T09:30:00.000Z');

    const { upcoming, past } = splitSchedulesByTimeline(
      [schedule],
      new Date('2026-03-01T10:00:00.000Z'),
    );

    expect(upcoming.map((item) => item.ids.id)).toEqual(['active-1']);
    expect(past).toHaveLength(0);
  });

  it('formats status labels', () => {
    expect(formatScheduleStatus('scheduled')).toBe('Scheduled');
    expect(formatScheduleStatus('rescheduled')).toBe('Rescheduled');
    expect(formatScheduleStatus('cancelled')).toBe('Cancelled');
    expect(formatScheduleStatus('completed')).toBe('Completed');
  });

  it('formats time ranges and day-time meta in AM/PM', () => {
    const schedule = buildSchedule('5', '2026-03-04T15:00:00.000Z');
    expect(formatScheduleDateTime(schedule)).toMatch(/\b(AM|PM)\b/);
    expect(formatScheduleDayTimeMeta(schedule)).toContain('•');
    expect(formatScheduleDayTimeMeta(schedule)).toMatch(/\b(AM|PM)\b/);
  });

  it('formats week-of-month title', () => {
    const schedule = buildSchedule('6', '2026-09-03T15:00:00.000Z');
    expect(formatScheduleWeekTitle(schedule)).toBe('Sep · Week 1');
  });

  it('formats the left-tile date badge', () => {
    const schedule = buildSchedule('7', '2026-09-14T15:00:00.000Z');
    expect(formatScheduleDateBadge(schedule)).toBe('Sep 14');
  });

  it('formats month-group session labels from raw timestamps without double-applying timezone', () => {
    const schedule = buildSchedule('tz-1', '2026-03-13T15:00:00.000Z');

    const groups = toMonthGroups(
      groupSchedulesByMonth([schedule], 'America/New_York'),
      new Date('2026-03-13T12:00:00.000Z'),
      'America/New_York',
    );

    expect(groups[0]?.sessions[0]?.time).toBe('Fri 11:00am EDT');
    expect(groups[0]?.sessions[0]?.dayNum).toBe('13');
  });

  it('expands recurring schedules when splitting timeline', () => {
    const schedule = {
      ...buildSchedule('rec-1', '2026-03-01T10:00:00.000Z'),
      description: 'Original description',
      recurrence: {
        ids: { id: 'recur-1', orgId: 'org-1' },
        rule: {
          frequency: 'daily' as const,
          interval: 1,
          count: 3,
        },
        exceptions: [
          {
            occurrenceKey: '2026-03-02T10:00:00.000Z',
            reason: 'Holiday break',
          },
        ],
      },
    };
    const { upcoming } = splitSchedulesByTimeline(
      [schedule],
      new Date('2026-03-01T09:00:00.000Z'),
    );
    expect(upcoming).toHaveLength(4);
    expect(
      upcoming.find((item) => item.uiState?.kind === 'exception')?.uiState?.reason,
    ).toBe('Holiday break');
    expect(upcoming.some((item) => item.uiState?.kind === 'exception')).toBe(true);
    expect(upcoming.some((item) => item.uiState?.kind === 'default')).toBe(true);
  });

  it('marks override occurrences as changed and preserves original timing metadata', () => {
    const schedule = {
      ...buildSchedule('rec-override', '2026-03-01T10:00:00.000Z'),
      recurrence: {
        ids: { id: 'recur-override', orgId: 'org-1' },
        rule: {
          frequency: 'daily' as const,
          interval: 1,
          count: 2,
        },
        overrides: [
          {
            occurrenceKey: '2026-03-02T10:00:00.000Z',
            patch: {
              startAt: '2026-03-03T12:00:00.000Z',
              endAt: '2026-03-03T13:00:00.000Z',
            },
          },
        ],
      },
    };

    const { upcoming } = splitSchedulesByTimeline(
      [schedule],
      new Date('2026-03-01T09:00:00.000Z'),
    );
    const changed = upcoming.find((item) => item.uiState?.kind === 'override');

    expect(changed?.startAt).toBe('2026-03-03T12:00:00.000Z');
    expect(changed?.uiState?.originalStartAt).toBe('2026-03-02T10:00:00.000Z');
    const mapped = toMonthGroups(
      groupSchedulesByMonth(upcoming),
      new Date('2026-03-01T09:00:00.000Z'),
    );
    const changedSession = mapped[0]?.sessions.find(
      (item) => item.variant === 'override',
    );
    expect(changedSession?.originalDate).toBe('Mar 2');
  });

  it('suppresses duplicate day entries when an override lands on an existing recurrence day', () => {
    const schedule = {
      ...buildSchedule('rec-dedupe', '2026-03-01T10:00:00.000Z'),
      recurrence: {
        ids: { id: 'recur-dedupe', orgId: 'org-1' },
        rule: {
          frequency: 'daily' as const,
          interval: 1,
          count: 3,
        },
        overrides: [
          {
            occurrenceKey: '2026-03-01T10:00:00.000Z',
            patch: {
              startAt: '2026-03-02T12:00:00.000Z',
              endAt: '2026-03-02T13:00:00.000Z',
            },
          },
        ],
      },
    };

    const { upcoming } = splitSchedulesByTimeline(
      [schedule],
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(upcoming.map((item) => item.startAt)).toEqual([
      '2026-03-02T12:00:00.000Z',
      '2026-03-03T10:00:00.000Z',
    ]);
    expect(upcoming[0]?.uiState?.kind).toBe('override');
  });

  it('builds a google calendar url', () => {
    const schedule = {
      ...buildSchedule('10', '2026-03-05T12:00:00.000Z'),
      title: 'Math Session',
      description: 'Algebra practice',
      location: 'Online',
    };
    const url = createGoogleCalendarUrl(schedule);
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('Math+Session');
    expect(url).toContain('Algebra+practice');
  });

  it('uses recurring start date to include full past timeline', () => {
    const recurring = {
      ...buildSchedule('rec-2', '2026-01-01T10:00:00.000Z'),
      recurrence: {
        ids: { id: 'recur-2', orgId: 'org-1' },
        rule: {
          frequency: 'weekly' as const,
          interval: 1,
          count: 10,
        },
      },
    };
    const laterOneOff = buildSchedule('one-off', '2026-02-20T10:00:00.000Z');

    const { past } = splitSchedulesByTimeline(
      [laterOneOff, recurring],
      new Date('2026-02-10T00:00:00.000Z'),
    );

    expect(
      past.some(
        (item) =>
          item.ids.id.startsWith('rec-2__') &&
          item.startAt.startsWith('2026-01-01T10:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('groups schedules by month in encounter order', () => {
    const schedules = [
      buildSchedule('1', '2026-03-05T12:00:00.000Z'),
      buildSchedule('2', '2026-03-10T12:00:00.000Z'),
      buildSchedule('3', '2026-04-01T12:00:00.000Z'),
    ];
    const grouped = groupSchedulesByMonth(schedules);
    expect(grouped.map((group) => group.monthKey)).toEqual(['2026-03', '2026-04']);
    expect(grouped[0]?.monthTitle).toBe('March 2026');
    expect(grouped[0]?.schedules.map((item) => item.ids.id)).toEqual(['1', '2']);
  });

  it('builds month key and completion percentage', () => {
    const schedule = buildSchedule('11', '2026-11-10T12:00:00.000Z');
    expect(getScheduleMonthKey(schedule)).toBe('2026-11');
    expect(calculateScheduleCompletionPercent(4, 3)).toBe(75);
    expect(calculateScheduleCompletionPercent(0, 3)).toBe(0);
  });

  it('takes only configured number of month groups', () => {
    const grouped = groupSchedulesByMonth([
      buildSchedule('1', '2026-01-10T12:00:00.000Z'),
      buildSchedule('2', '2026-02-10T12:00:00.000Z'),
      buildSchedule('3', '2026-03-10T12:00:00.000Z'),
      buildSchedule('4', '2026-04-10T12:00:00.000Z'),
      buildSchedule('5', '2026-05-10T12:00:00.000Z'),
    ]);

    const limited = takeMonthGroups(grouped, 4);
    expect(limited).toHaveLength(4);
    expect(limited.map((group) => group.monthKey)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('maps month groups to month sections with session cards', () => {
    const groups = groupSchedulesByMonth([
      buildSchedule('1', '2026-03-03T16:00:00.000Z'),
      { ...buildSchedule('2', '2026-03-10T16:00:00.000Z'), status: 'completed' as const },
    ]);
    const mapped = toMonthGroups(groups, new Date('2026-03-03T18:00:00.000Z'));
    expect(mapped[0]?.month).toBe('March');
    expect(mapped[0]?.year).toBe('2026');
    expect(mapped[0]?.totalCount).toBe(2);
    expect(mapped[0]?.completedCount).toBe(1);
    expect(mapped[0]?.sessions[0]).toEqual(
      expect.objectContaining({
        id: '1',
        dayName: 'Tue',
        dayNum: '3',
        endAt: '2026-03-03T17:00:00.000Z',
        isToday: true,
        isLive: false,
        variant: 'default',
      }),
    );
  });

  it('counts week labels from the combined monthly timeline for upcoming and past', () => {
    const schedules = [
      buildSchedule('w1', '2026-03-01T16:00:00.000Z'),
      buildSchedule('w1b', '2026-03-03T16:00:00.000Z'),
      buildSchedule('w2', '2026-03-08T16:00:00.000Z'),
    ];

    const upcoming = toMonthGroups(
      groupSchedulesByMonth(schedules),
      new Date('2026-02-25T00:00:00.000Z'),
    );
    expect(upcoming[0]?.sessions.map((session) => session.label)).toEqual([
      'Mar · Week 1 · Session 1',
      'Mar · Week 1 · Session 2',
      'Mar · Week 2 · Session 1',
    ]);

    const past = toMonthGroups(
      groupSchedulesByMonth([...schedules].reverse()),
      new Date('2026-03-30T00:00:00.000Z'),
    );
    expect(past[0]?.sessions.map((session) => session.label)).toEqual([
      'Mar · Week 2 · Session 1',
      'Mar · Week 1 · Session 1',
      'Mar · Week 1 · Session 2',
    ]);
  });

  it('uses actual calendar week-of-month in labels', () => {
    const mapped = toMonthGroups(
      groupSchedulesByMonth([buildSchedule('wk3', '2026-03-20T15:00:00.000Z')]),
      new Date('2026-03-10T00:00:00.000Z'),
    );

    expect(mapped[0]?.sessions[0]?.label).toBe('Mar · Week 3 · Session 1');
  });

  it('formats session time as short weekday and compact meridiem time', () => {
    const mapped = toMonthGroups(
      groupSchedulesByMonth([buildSchedule('time-1', '2026-03-03T15:00:00.000Z')]),
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(mapped[0]?.sessions[0]?.time).toMatch(/^Tue \d{1,2}:\d{2}(am|pm) [A-Z]{2,4}$/);
  });

  it('marks sessions live only while current time is within session window', () => {
    const groups = groupSchedulesByMonth([
      buildSchedule('live-1', '2026-03-03T15:00:00.000Z'),
    ]);

    const before = toMonthGroups(groups, new Date('2026-03-03T14:59:00.000Z'));
    const during = toMonthGroups(groups, new Date('2026-03-03T15:30:00.000Z'));
    const after = toMonthGroups(groups, new Date('2026-03-03T16:00:00.000Z'));

    expect(before[0]?.sessions[0]?.isLive).toBe(false);
    expect(during[0]?.sessions[0]?.isLive).toBe(true);
    expect(after[0]?.sessions[0]?.isLive).toBe(false);
  });

  it('builds month progress stats from all scheduled sessions in the month', () => {
    const stats = getMonthProgressStatsByKey(
      [
        buildSchedule('1', '2026-03-03T16:00:00.000Z'),
        {
          ...buildSchedule('2', '2026-03-10T16:00:00.000Z'),
          status: 'completed' as const,
        },
        {
          ...buildSchedule('3', '2026-03-12T16:00:00.000Z'),
          status: 'cancelled' as const,
        },
        buildSchedule('4', '2026-04-02T16:00:00.000Z'),
      ],
      new Date('2026-03-09T00:00:00.000Z'),
    );

    expect(stats.get('2026-03')).toEqual({
      scheduledCount: 2,
      completedCount: 2,
    });
    expect(stats.get('2026-04')).toEqual({
      scheduledCount: 1,
      completedCount: 0,
    });
  });

  it('counts past non-cancelled lessons as complete for month progress', () => {
    const stats = getMonthProgressStatsByKey(
      [
        buildSchedule('past-scheduled', '2026-03-03T16:00:00.000Z'),
        buildSchedule('future-scheduled', '2026-03-20T16:00:00.000Z'),
        {
          ...buildSchedule('cancelled', '2026-03-05T16:00:00.000Z'),
          status: 'cancelled' as const,
        },
      ],
      new Date('2026-03-10T00:00:00.000Z'),
    );

    expect(stats.get('2026-03')).toEqual({
      scheduledCount: 2,
      completedCount: 1,
    });
  });

  it('selects only the first upcoming non-disabled session as joinable', () => {
    const schedules = [
      {
        ...buildSchedule('1', '2026-03-03T16:00:00.000Z'),
        uiState: { kind: 'exception' as const, disabled: true },
      },
      buildSchedule('2', '2026-03-04T16:00:00.000Z'),
      buildSchedule('3', '2026-03-05T16:00:00.000Z'),
    ];

    expect(getJoinableSessionId(schedules)).toBe('2');
  });
});
