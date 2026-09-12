import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLearningSpaceScheduleDiffPlan } from '@iconicedu/web/lib/admin/learning-space-update';

describe('buildLearningSpaceScheduleDiffPlan', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns no changes when schedules are unchanged', () => {
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-1',
          title: 'Math Foundations',
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      nextSchedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(plan.added).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
    expect(plan.rescheduled).toHaveLength(0);
  });

  it('returns one rescheduled change when time changes for an existing schedule', () => {
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-1',
          title: 'Math Foundations',
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      nextSchedules: [
        {
          startDate: '2026-03-14T14:30:00.000Z',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:30' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(plan.added).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
    expect(plan.rescheduled).toHaveLength(1);
    expect(plan.rescheduled[0]?.previous.id).toBe('schedule-1');
    expect(plan.rescheduled[0]?.next.startAt).toBe('2026-03-14T14:30:00.000Z');
  });

  it('classifies mixed multi-schedule changes into rescheduled and removed', () => {
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-a',
          title: 'Math Foundations',
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
        {
          id: 'schedule-b',
          title: 'Math Foundations',
          start_at: '2026-03-14T16:00:00.000Z',
          end_at: '2026-03-14T17:00:00.000Z',
          timezone: 'UTC',
        },
        {
          id: 'schedule-c',
          title: 'Math Foundations',
          start_at: '2026-03-14T18:00:00.000Z',
          end_at: '2026-03-14T19:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      nextSchedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
        {
          startDate: '2026-03-14T16:30:00.000Z',
          startTime: '16:30',
          endTime: '17:30',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '16:30' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(plan.rescheduled).toHaveLength(1);
    expect(plan.rescheduled[0]?.previous.id).toBe('schedule-b');
    expect(plan.rescheduled[0]?.next.startAt).toBe('2026-03-14T16:30:00.000Z');
    expect(plan.removed).toHaveLength(1);
    expect(plan.removed[0]?.id).toBe('schedule-c');
    expect(plan.added).toHaveLength(0);
  });

  it('exposes the real schedule id for every matched schedule, changed or not', () => {
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-unchanged',
          title: 'Math Foundations',
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
        {
          id: 'schedule-changed',
          title: 'Math Foundations',
          start_at: '2026-03-14T16:00:00.000Z',
          end_at: '2026-03-14T17:00:00.000Z',
          timezone: 'UTC',
        },
        {
          id: 'schedule-removed',
          title: 'Math Foundations',
          start_at: '2026-03-14T18:00:00.000Z',
          end_at: '2026-03-14T19:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      nextSchedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
        {
          startDate: '2026-03-14T16:30:00.000Z',
          startTime: '16:30',
          endTime: '17:30',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '16:30' }],
          },
          exceptions: [],
          overrides: [],
        },
        {
          startDate: '2026-06-13T09:00:00.000Z',
          startTime: '09:00',
          endTime: '10:00',
          timezone: 'UTC',
          rule: null,
          exceptions: [],
          overrides: [],
        },
      ],
    });

    // Index-aligned with `nextSchedules`: [0] matched unchanged, [1] matched
    // changed, [2] a genuinely new schedule (3 months later) with no
    // plausible previous match — must NOT get force-paired with schedule-removed
    // just because it's the only thing left over on each side.
    expect(plan.previousIdByNextIndex).toEqual([
      'schedule-unchanged',
      'schedule-changed',
      null,
    ]);
    expect(plan.removedScheduleIds).toEqual(['schedule-removed']);
  });

  it('flags a recurrence-presence change even when the combined hash is identical', () => {
    // A one-off session's synthesized default recurrence (weekly, its own
    // weekday) can be byte-identical to an explicit weekly rule on the same
    // weekday/time — the most natural way an admin would "make this recurring."
    // The hash comparison alone can't see this edit at all; recurrencePresenceChanged
    // must catch it so the edit isn't silently dropped as a no-op.
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-oneoff',
          title: 'Math with Ms.Shenaly',
          start_at: '2026-03-14T14:00:00.000Z', // a Saturday
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      // No entry in recurrencesByScheduleId for 'schedule-oneoff' — it has no
      // recurrence row today, matching a genuinely one-off session.
      nextSchedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    // The hash-based comparison alone sees no difference (this is the bug).
    expect(plan.rescheduled).toHaveLength(0);
    expect(plan.added).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
    // recurrencePresenceChanged is what actually catches the edit.
    expect(plan.recurrencePresenceChanged).toBe(true);
  });

  it('does not flag a recurrence-presence change when a schedule is already recurring and resaved unchanged', () => {
    const plan = buildLearningSpaceScheduleDiffPlan({
      previousSchedules: [
        {
          id: 'schedule-recurring',
          title: 'Math with Ms.Shenaly',
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      recurrencesByScheduleId: new Map([
        [
          'schedule-recurring',
          {
            id: 'recurrence-1',
            schedule_id: 'schedule-recurring',
            frequency: 'weekly',
            interval: 1,
            count: null,
            until: null,
            timezone: 'UTC',
            byday: ['SA'],
          },
        ],
      ]),
      nextSchedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(plan.recurrencePresenceChanged).toBe(false);
  });
});
