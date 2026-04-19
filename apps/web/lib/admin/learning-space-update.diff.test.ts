import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildExceptionAndOverrideScheduleChangeActivities,
  buildLearningSpaceScheduleDiffPlan,
  buildRemovedMembersActivity,
} from '@iconicedu/web/lib/admin/learning-space-update';

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

  it('returns one rescheduled change when only end time changes', () => {
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
          endTime: '16:00',
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
    expect(plan.rescheduled).toHaveLength(1);
    expect(plan.rescheduled[0]?.previous.endAt).toBe('2026-03-14T15:00:00.000Z');
    expect(plan.rescheduled[0]?.next.endAt).toBe('2026-03-14T16:00:00.000Z');
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

  it('builds one plural removal activity payload when multiple participants are removed', () => {
    const activity = buildRemovedMembersActivity({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      removedParticipants: [
        {
          profileId: 'profile-1',
          snapshot: { name: 'Alex Educator', avatarUrl: null, themeKey: 'teal' },
        },
        {
          profileId: 'profile-2',
          snapshot: { name: 'Riley Guardian', avatarUrl: null, themeKey: 'rose' },
        },
      ],
      invitedMembers: [],
    });

    expect(activity).not.toBeNull();
    expect(activity?.eventType).toBe('member.removed');
    expect(activity?.payload.memberCount).toBe(2);
    expect(activity?.payload.members).toHaveLength(2);
    expect(activity?.dedupeKey).toBe(
      'member.removed:space-1:profile-1:2026-03-08T10:00:00.000Z',
    );
  });

  it('builds one singular removal activity payload when one participant is removed', () => {
    const activity = buildRemovedMembersActivity({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      removedParticipants: [
        {
          profileId: 'profile-1',
          snapshot: { name: 'Alex Educator', avatarUrl: null, themeKey: 'teal' },
        },
      ],
      invitedMembers: [],
    });

    expect(activity).not.toBeNull();
    expect(activity?.eventType).toBe('member.removed');
    expect(activity?.payload.memberCount).toBe(1);
    expect(activity?.dedupeKey).toBe(
      'member.removed:space-1:profile-1:2026-03-08T10:00:00.000Z',
    );
  });

  it('builds one activity per new exception and changed override', () => {
    const activities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [{ occurrenceKey: '2026-03-10T21:00:00.000Z', reason: null }],
            overrides: [
              {
                occurrenceKey: '2026-03-17T21:00:00.000Z',
                startAt: '2026-03-18T21:00:00.000Z',
                endAt: '2026-03-18T22:00:00.000Z',
                reason: null,
              },
            ],
          },
          next: {
            exceptions: [
              { occurrenceKey: '2026-03-10T21:00:00.000Z', reason: null },
              { occurrenceKey: '2026-03-24T21:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [
              {
                occurrenceKey: '2026-03-17T21:00:00.000Z',
                startAt: '2026-03-19T21:30:00.000Z',
                endAt: '2026-03-19T22:30:00.000Z',
                reason: 'Rescheduled due to event',
              },
            ],
          },
        },
      ],
    });

    expect(activities).toHaveLength(2);
    expect(activities.map((entry) => entry.eventType)).toEqual([
      'class.session.canceled',
      'class.session.rescheduled',
    ]);
    expect(activities[0]?.payload.canceledStartAt).toBe('2026-03-24T21:00:00.000Z');
    expect(activities[0]?.payload.canceledReason).toBe('Holiday');
    expect(activities[1]?.payload.rescheduledFromStartAt).toBe(
      '2026-03-18T21:00:00.000Z',
    );
    expect(activities[1]?.payload.rescheduledToStartAt).toBe('2026-03-19T21:30:00.000Z');
    expect(activities[1]?.payload.rescheduledReason).toBe('Rescheduled due to event');
  });

  it('emits class.session.scheduled when an exception or override is removed', () => {
    const activities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      invitedMembers: [],
      nextSessionStartAt: '2026-03-31T21:00:00.000Z',
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [
              { occurrenceKey: '2026-03-10T21:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [
              {
                occurrenceKey: '2026-03-17T21:00:00.000Z',
                startAt: '2026-03-18T21:30:00.000Z',
                endAt: '2026-03-18T22:30:00.000Z',
                reason: null,
              },
            ],
          },
          next: {
            exceptions: [],
            overrides: [],
          },
        },
      ],
    });

    expect(activities).toHaveLength(2);
    expect(activities.map((entry) => entry.eventType)).toEqual([
      'class.session.scheduled',
      'class.session.scheduled',
    ]);
    expect(activities[0]?.payload.startAt).toBe('2026-03-10T21:00:00.000Z');
    expect(activities[1]?.payload.startAt).toBe('2026-03-17T21:00:00.000Z');
    expect(activities[0]?.payload.firstSessionStartAt).toBe('2026-03-31T21:00:00.000Z');
  });

  it('does not emit canceled/rescheduled/scheduled changes for past session dates', () => {
    const canceledActivities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-30T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [],
            overrides: [],
          },
          next: {
            exceptions: [
              { occurrenceKey: '2026-03-10T21:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [],
          },
        },
      ],
    });

    const rescheduledActivities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-30T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [],
            overrides: [],
          },
          next: {
            exceptions: [],
            overrides: [
              {
                occurrenceKey: '2026-03-17T21:00:00.000Z',
                startAt: '2026-03-18T21:30:00.000Z',
                endAt: '2026-03-18T22:30:00.000Z',
                reason: 'Late bus',
              },
            ],
          },
        },
      ],
    });

    const unscheduledRemovalActivities =
      buildExceptionAndOverrideScheduleChangeActivities({
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        occurredAt: '2026-03-30T10:00:00.000Z',
        invitedMembers: [],
        pairs: [
          {
            scheduleId: 'schedule-1',
            timezone: 'America/New_York',
            previous: {
              exceptions: [
                { occurrenceKey: '2026-03-10T21:00:00.000Z', reason: 'Holiday' },
              ],
              overrides: [
                {
                  occurrenceKey: '2026-03-17T21:00:00.000Z',
                  startAt: '2026-03-18T21:30:00.000Z',
                  endAt: '2026-03-18T22:30:00.000Z',
                  reason: null,
                },
              ],
            },
            next: {
              exceptions: [],
              overrides: [],
            },
          },
        ],
      });

    expect(canceledActivities).toEqual([]);
    expect(rescheduledActivities).toEqual([]);
    expect(unscheduledRemovalActivities).toEqual([]);
  });

  it('does not log skip decision reason for past schedule-change activities', () => {
    vi.stubEnv('DEBUG_LEARNING_SPACE_SCHEDULE_DIFF', '1');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-30T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [],
            overrides: [],
          },
          next: {
            exceptions: [
              { occurrenceKey: '2026-03-10T21:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [],
          },
        },
      ],
    });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not log publish decision reason for future schedule-change activities', () => {
    vi.stubEnv('DEBUG_LEARNING_SPACE_SCHEDULE_DIFF', '1');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [],
            overrides: [],
          },
          next: {
            exceptions: [],
            overrides: [
              {
                occurrenceKey: '2026-03-17T21:00:00.000Z',
                startAt: '2026-03-18T21:30:00.000Z',
                endAt: '2026-03-18T22:30:00.000Z',
                reason: 'Late bus',
              },
            ],
          },
        },
      ],
    });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not emit diffs for timezone-shifted keys when full hash is equal', () => {
    const activities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previousFullHash: 'same-hash',
          nextFullHash: 'same-hash',
          previous: {
            exceptions: [
              { occurrenceKey: '2026-03-09T16:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [
              {
                occurrenceKey: '2026-03-23T16:00:00.000Z',
                startAt: '2026-03-30T16:00:00.000Z',
                endAt: '2026-03-30T17:00:00.000Z',
                reason: null,
              },
            ],
          },
          next: {
            exceptions: [
              { occurrenceKey: '2026-03-09T20:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [
              {
                occurrenceKey: '2026-03-23T20:00:00.000Z',
                startAt: '2026-03-30T20:00:00.000Z',
                endAt: '2026-03-30T21:00:00.000Z',
                reason: null,
              },
            ],
          },
        },
      ],
    });

    expect(activities).toEqual([]);
  });

  it('emits class.session.canceled when exception is added on a date that already has an override', () => {
    const activities = buildExceptionAndOverrideScheduleChangeActivities({
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      occurredAt: '2026-03-08T10:00:00.000Z',
      invitedMembers: [],
      pairs: [
        {
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          previous: {
            exceptions: [],
            overrides: [
              {
                occurrenceKey: '2026-03-26T16:00:00.000Z',
                startAt: '2026-03-26T17:00:00.000Z',
                endAt: '2026-03-26T18:00:00.000Z',
                reason: null,
              },
            ],
          },
          next: {
            exceptions: [
              { occurrenceKey: '2026-03-26T16:00:00.000Z', reason: 'Holiday' },
            ],
            overrides: [
              {
                occurrenceKey: '2026-03-26T16:00:00.000Z',
                startAt: '2026-03-26T17:00:00.000Z',
                endAt: '2026-03-26T18:00:00.000Z',
                reason: null,
              },
            ],
          },
        },
      ],
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]?.eventType).toBe('class.session.canceled');
    expect(activities[0]?.payload.canceledReason).toBe('Holiday');
  });
});
