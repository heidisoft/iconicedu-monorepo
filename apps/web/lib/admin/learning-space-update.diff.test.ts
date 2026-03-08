import { describe, expect, it } from 'vitest';

import { buildLearningSpaceScheduleDiffPlan } from '@iconicedu/web/lib/admin/learning-space-update';

describe('buildLearningSpaceScheduleDiffPlan', () => {
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

  it('returns one rescheduled change when time changes for existing schedule', () => {
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

  it('does not mark rescheduled when payload startDate differs but resolves to same weekday occurrence', () => {
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
          // Tuesday base date, but weekly Saturday at 14:00 resolves to 2026-03-14T14:00:00.000Z
          startDate: '2026-03-10T00:00:00.000Z',
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
});
