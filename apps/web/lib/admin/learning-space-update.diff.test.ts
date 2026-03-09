import { describe, expect, it } from 'vitest';

import {
  buildExceptionAndOverrideScheduleChangeActivities,
  buildLearningSpaceScheduleDiffPlan,
  buildRemovedMembersActivity,
} from '@iconicedu/web/lib/admin/learning-space-update';

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
    expect(activity?.eventType).toBe('members.removed');
    expect(activity?.payload.memberCount).toBe(2);
    expect(activity?.payload.members).toHaveLength(2);
    expect(activity?.dedupeKey).toBe('members.removed:space-1:2026-03-08T10:00:00.000Z');
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
      'session.canceled',
      'session.rescheduled',
    ]);
    expect(activities[0]?.payload.canceledStartAt).toBe('2026-03-24T21:00:00.000Z');
    expect(activities[0]?.payload.canceledReason).toBe('Holiday');
    expect(activities[1]?.payload.rescheduledFromStartAt).toBe(
      '2026-03-18T21:00:00.000Z',
    );
    expect(activities[1]?.payload.rescheduledToStartAt).toBe('2026-03-19T21:30:00.000Z');
    expect(activities[1]?.payload.rescheduledReason).toBe('Rescheduled due to event');
  });

  it('emits session.scheduled when an exception or override is removed', () => {
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
      'session.scheduled',
      'session.scheduled',
    ]);
    expect(activities[0]?.payload.startAt).toBe('2026-03-10T21:00:00.000Z');
    expect(activities[1]?.payload.startAt).toBe('2026-03-17T21:00:00.000Z');
    expect(activities[0]?.payload.firstSessionStartAt).toBe('2026-03-31T21:00:00.000Z');
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

  it('emits session.canceled when exception is added on a date that already has an override', () => {
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
    expect(activities[0]?.eventType).toBe('session.canceled');
    expect(activities[0]?.payload.canceledReason).toBe('Holiday');
  });
});
