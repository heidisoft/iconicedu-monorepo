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
});
