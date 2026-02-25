import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import {
  calculateScheduleCompletionPercent,
  createGoogleCalendarUrl,
  formatScheduleDateBadge,
  formatScheduleDateTime,
  formatScheduleDayTimeMeta,
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
    expect(upcoming.map((item) => item.ids.id)).toEqual(['1', '3']);
    expect(past.map((item) => item.ids.id)).toEqual(['2', '4']);
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
    const { upcoming } = splitSchedulesByTimeline([schedule], new Date('2026-03-01T09:00:00.000Z'));
    expect(upcoming).toHaveLength(3);
    expect(upcoming.some((item) => item.description === 'Holiday break')).toBe(true);
    expect(upcoming.some((item) => item.description === 'Original description')).toBe(
      false,
    );
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
        isToday: true,
      }),
    );
  });
});
