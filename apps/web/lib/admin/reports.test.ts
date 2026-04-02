import { describe, expect, it } from 'vitest';

import {
  buildAdminReportsDashboardVM,
  createEmptyAdminReportsDashboardVM,
} from '@iconicedu/web/lib/admin/reports';

describe('admin reports', () => {
  const now = new Date('2026-04-02T12:00:00.000Z');

  it('returns an empty dashboard shape for empty org data', () => {
    const dashboard = createEmptyAdminReportsDashboardVM(now);

    expect(dashboard.generatedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(dashboard.summary).toEqual([]);
    expect(dashboard.userSummary).toEqual([]);
    expect(dashboard.classroomSummary).toEqual([]);
    expect(dashboard.channelSummary).toEqual([]);
    expect(dashboard.activitySummary).toEqual([]);
    expect(dashboard.monthlyUserGrowth).toEqual([]);
    expect(dashboard.upcomingScheduledSessionsByWeek).toEqual([]);
    expect(dashboard.inboxActivityByMonth).toEqual([]);
    expect(dashboard.notificationDispatchByChannel).toEqual([]);
  });

  it('builds report metrics from users, sessions, messages, and families', () => {
    const dashboard = buildAdminReportsDashboardVM(
      {
        accounts: [
          {
            id: 'account-guardian-1',
            org_id: 'org-1',
            status: 'active',
            primary_role: 'guardian',
            created_at: '2025-12-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
          {
            id: 'account-child-1',
            org_id: 'org-1',
            status: 'active',
            primary_role: 'child',
            created_at: '2026-01-10T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
          {
            id: 'account-educator-1',
            org_id: 'org-1',
            status: 'active',
            primary_role: 'educator',
            created_at: '2026-02-03T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        profiles: [
          {
            id: 'profile-guardian-1',
            org_id: 'org-1',
            account_id: 'account-guardian-1',
            kind: 'guardian',
            display_name: 'Jamie Stone',
            avatar_source: 'seed',
            status: 'active',
            created_at: '2025-12-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
          {
            id: 'profile-child-1',
            org_id: 'org-1',
            account_id: 'account-child-1',
            kind: 'child',
            display_name: 'Nia Stone',
            avatar_source: 'seed',
            status: 'active',
            created_at: '2026-01-10T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
          {
            id: 'profile-educator-1',
            org_id: 'org-1',
            account_id: 'account-educator-1',
            kind: 'educator',
            display_name: 'Taylor Reed',
            avatar_source: 'seed',
            status: 'active',
            created_at: '2026-02-03T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        families: [
          {
            id: 'family-1',
            org_id: 'org-1',
            display_name: 'Stone Family',
            created_at: '2025-12-05T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        familyLinks: [
          {
            id: 'link-1',
            org_id: 'org-1',
            family_id: 'family-1',
            guardian_account_id: 'account-guardian-1',
            child_account_id: 'account-child-1',
            relation: 'guardian',
          },
        ] as never,
        channels: [
          {
            id: 'channel-1',
            org_id: 'org-1',
            kind: 'group_dm',
            topic: 'Math support',
            visibility: 'private',
            purpose: 'learning-space',
            status: 'active',
            created_at: '2026-01-15T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        channelMembers: [
          {
            id: 'member-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            profile_id: 'profile-educator-1',
            joined_at: '2026-01-15T10:00:00.000Z',
            created_at: '2026-01-15T10:00:00.000Z',
            updated_at: '2026-01-15T10:00:00.000Z',
          },
          {
            id: 'member-2',
            org_id: 'org-1',
            channel_id: 'channel-1',
            profile_id: 'profile-child-1',
            joined_at: '2026-01-15T10:00:00.000Z',
            created_at: '2026-01-15T10:00:00.000Z',
            updated_at: '2026-01-15T10:00:00.000Z',
          },
        ] as never,
        learningSpaces: [
          {
            id: 'space-1',
            org_id: 'org-1',
            kind: 'one_on_one',
            status: 'active',
            title: 'Algebra tutoring',
            created_at: '2026-01-08T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        schedules: [
          {
            ids: {
              id: 'schedule-0',
              parentId: 'space-1',
            },
            title: 'Algebra tutoring',
            startAt: '2026-04-01T14:00:00.000Z',
            endAt: '2026-04-01T15:00:00.000Z',
            status: 'scheduled',
            visibility: 'org',
            participants: [],
            source: 'manual',
            audit: {
              createdAt: '2026-03-28T10:00:00.000Z',
              updatedAt: '2026-03-28T10:00:00.000Z',
            },
          },
          {
            ids: {
              id: 'schedule-1',
              parentId: 'space-1',
            },
            title: 'Algebra tutoring',
            startAt: '2026-04-03T14:00:00.000Z',
            endAt: '2026-04-03T15:00:00.000Z',
            status: 'scheduled',
            visibility: 'org',
            participants: [],
            source: 'manual',
            audit: {
              createdAt: '2026-03-28T10:00:00.000Z',
              updatedAt: '2026-03-28T10:00:00.000Z',
            },
          },
          {
            ids: {
              id: 'schedule-2',
              parentId: 'space-1',
            },
            title: 'Algebra tutoring',
            startAt: '2026-04-08T14:00:00.000Z',
            endAt: '2026-04-08T15:00:00.000Z',
            status: 'scheduled',
            visibility: 'org',
            participants: [],
            source: 'manual',
            audit: {
              createdAt: '2026-03-28T10:00:00.000Z',
              updatedAt: '2026-03-28T10:00:00.000Z',
            },
          },
        ] as never,
        messages: [
          {
            id: 'message-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-guardian-1',
            type: 'text',
            visibility_type: 'channel',
            created_at: '2026-02-10T10:00:00.000Z',
            updated_at: '2026-02-10T10:00:00.000Z',
          },
          {
            id: 'message-2',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-educator-1',
            type: 'text',
            visibility_type: 'channel',
            created_at: '2026-03-11T10:00:00.000Z',
            updated_at: '2026-03-11T10:00:00.000Z',
          },
        ] as never,
        activityFeedItems: [
          {
            id: 'activity-1',
            org_id: 'org-1',
            recipient_profile_id: 'profile-guardian-1',
            kind: 'leaf',
            occurred_at: '2026-04-01T10:00:00.000Z',
            created_at: '2026-04-01T10:00:00.000Z',
            tab_key: 'all',
            audience: {},
            verb: 'message.posted',
            content: {},
            updated_at: '2026-04-01T10:00:00.000Z',
            is_read: true,
            read_at: '2026-04-01T12:00:00.000Z',
          },
          {
            id: 'activity-2',
            org_id: 'org-1',
            recipient_profile_id: 'profile-child-1',
            kind: 'leaf',
            occurred_at: '2026-04-02T09:00:00.000Z',
            created_at: '2026-04-02T09:00:00.000Z',
            tab_key: 'classes',
            audience: {},
            verb: 'session.reminder',
            content: {},
            updated_at: '2026-04-02T09:00:00.000Z',
            is_read: false,
            read_at: null,
          },
        ] as never,
        notificationDispatchJobs: [
          {
            id: 'dispatch-1',
            org_id: 'org-1',
            activity_event_id: 'event-1',
            recipient_profile_id: 'profile-guardian-1',
            pref_key: 'messages.mentions',
            delivery_channel: 'push',
            delivery_timing: 'immediate',
            attempt_bucket: '2026-04-01T10',
            run_at: '2026-04-01T10:00:00.000Z',
            payload: {},
            status: 'succeeded',
            attempt_count: 1,
            max_attempts: 3,
            dispatched_at: '2026-04-01T10:00:10.000Z',
            created_at: '2026-04-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:10.000Z',
          },
          {
            id: 'dispatch-2',
            org_id: 'org-1',
            activity_event_id: 'event-2',
            recipient_profile_id: 'profile-child-1',
            pref_key: 'sessions.reminders',
            delivery_channel: 'email',
            delivery_timing: 'immediate',
            attempt_bucket: '2026-04-02T09',
            run_at: '2026-04-02T09:00:00.000Z',
            payload: {},
            status: 'failed',
            attempt_count: 1,
            max_attempts: 3,
            created_at: '2026-04-02T09:00:00.000Z',
            updated_at: '2026-04-02T09:00:10.000Z',
          },
        ] as never,
        liveSessions: [
          {
            id: 'session-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            provider: 'daily',
            session_scope_key: 'channel:channel-1',
            status: 'ended',
            started_by_profile_id: 'profile-educator-1',
            join_path: '/join/1',
            started_at: '2026-03-14T10:00:00.000Z',
            ended_at: '2026-03-14T11:00:00.000Z',
            created_at: '2026-03-14T10:00:00.000Z',
            updated_at: '2026-03-14T11:00:00.000Z',
          },
          {
            id: 'session-2',
            org_id: 'org-1',
            channel_id: 'channel-1',
            provider: 'daily',
            session_scope_key: 'channel:channel-1',
            status: 'ended',
            started_by_profile_id: 'profile-guardian-1',
            join_path: '/join/2',
            started_at: '2026-03-21T10:00:00.000Z',
            ended_at: '2026-03-21T11:00:00.000Z',
            created_at: '2026-03-21T10:00:00.000Z',
            updated_at: '2026-03-21T11:00:00.000Z',
          },
        ] as never,
        liveSessionParticipants: [
          {
            id: 'participant-1',
            org_id: 'org-1',
            live_session_id: 'session-1',
            channel_id: 'channel-1',
            profile_id: 'profile-child-1',
            attendance_status: 'full',
            first_joined_at: '2026-03-14T10:00:00.000Z',
            created_at: '2026-03-14T10:00:00.000Z',
            updated_at: '2026-03-14T11:00:00.000Z',
          },
          {
            id: 'participant-2',
            org_id: 'org-1',
            live_session_id: 'session-1',
            channel_id: 'channel-1',
            profile_id: 'profile-educator-1',
            attendance_status: 'full',
            first_joined_at: '2026-03-14T10:00:00.000Z',
            created_at: '2026-03-14T10:00:00.000Z',
            updated_at: '2026-03-14T11:00:00.000Z',
          },
          {
            id: 'participant-3',
            org_id: 'org-1',
            live_session_id: 'session-2',
            channel_id: 'channel-1',
            profile_id: 'profile-child-1',
            attendance_status: 'no_show',
            created_at: '2026-03-21T10:00:00.000Z',
            updated_at: '2026-03-21T11:00:00.000Z',
          },
          {
            id: 'participant-4',
            org_id: 'org-1',
            live_session_id: 'session-2',
            channel_id: 'channel-1',
            profile_id: 'profile-educator-1',
            attendance_status: 'full',
            first_joined_at: '2026-03-21T10:00:00.000Z',
            created_at: '2026-03-21T10:00:00.000Z',
            updated_at: '2026-03-21T11:00:00.000Z',
          },
        ] as never,
      },
      { now },
    );

    expect(dashboard.summary.find((metric) => metric.key === 'total-users')?.value).toBe(
      3,
    );
    expect(
      dashboard.summary.find((metric) => metric.key === 'active-educators')?.value,
    ).toBe(1);
    expect(
      dashboard.summary.find((metric) => metric.key === 'active-families')?.value,
    ).toBe(1);
    expect(
      dashboard.summary.find((metric) => metric.key === 'completed-sessions-this-month')
        ?.value,
    ).toBe(1);
    expect(dashboard.userSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'educators', value: 1 }),
        expect.objectContaining({ key: 'guardians', value: 1 }),
        expect.objectContaining({ key: 'learners', value: 1 }),
      ]),
    );
    expect(dashboard.channelSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'total-channels', value: 1 }),
        expect.objectContaining({ key: 'group-conversation-channels', value: 1 }),
      ]),
    );
    expect(
      dashboard.activitySummary.find((metric) => metric.key === 'inbox-items-this-month')
        ?.value,
    ).toBe(2);
    expect(
      dashboard.activitySummary.find(
        (metric) => metric.key === 'notifications-sent-this-month',
      )?.value,
    ).toBe(1);

    const marchCompletions = dashboard.monthlyCompletedSessions.find(
      (point) => point.label === 'Mar 2026',
    );
    expect(marchCompletions?.value).toBe(2);

    const marchAttendance = dashboard.monthlyAttendance.find(
      (point) => point.label === 'Mar 2026',
    );
    expect(marchAttendance?.value).toBe(0.75);

    expect(dashboard.completedSessionsByTeacher[0]).toMatchObject({
      label: 'Taylor Reed',
      value: 2,
    });
    expect(dashboard.completedSessionsByFamily[0]).toMatchObject({
      label: 'Stone Family',
      value: 2,
    });
    expect(dashboard.channelUsage[0]).toMatchObject({
      label: 'Math support',
      value: 2,
      secondaryValue: 2,
    });
    expect(dashboard.channelTypeMix[0]).toMatchObject({
      label: 'group_dm',
      value: 2,
    });
    expect(dashboard.notificationDispatchByChannel[0]).toMatchObject({
      label: 'email',
      value: 1,
    });
    expect(dashboard.inboxActivityByVerb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'message.posted',
          value: 1,
        }),
      ]),
    );
    expect(
      dashboard.classroomSummary.find((metric) => metric.key === 'scheduled-this-week')
        ?.value,
    ).toBe(2);
    expect(
      dashboard.classroomSummary.find((metric) => metric.key === 'upcoming-next-7-days')
        ?.value,
    ).toBe(2);
    expect(
      dashboard.upcomingScheduledSessionsByWeek.some((point) => point.value > 0),
    ).toBe(true);
  });

  it('counts past sessions as completed even when status is not ended', () => {
    const dashboard = buildAdminReportsDashboardVM(
      {
        accounts: [] as never,
        profiles: [
          {
            id: 'profile-educator-1',
            org_id: 'org-1',
            account_id: 'account-educator-1',
            kind: 'educator',
            display_name: 'Taylor Reed',
            avatar_source: 'seed',
            status: 'active',
            created_at: '2026-01-01T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        families: [] as never,
        familyLinks: [] as never,
        channels: [
          {
            id: 'channel-1',
            org_id: 'org-1',
            kind: 'group_dm',
            topic: 'Math support',
            visibility: 'private',
            purpose: 'learning-space',
            status: 'active',
            created_at: '2026-01-15T10:00:00.000Z',
            updated_at: '2026-04-01T10:00:00.000Z',
          },
        ] as never,
        channelMembers: [
          {
            id: 'member-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            profile_id: 'profile-educator-1',
            joined_at: '2026-01-15T10:00:00.000Z',
            created_at: '2026-01-15T10:00:00.000Z',
            updated_at: '2026-01-15T10:00:00.000Z',
          },
        ] as never,
        learningSpaces: [] as never,
        schedules: [] as never,
        messages: [] as never,
        activityFeedItems: [] as never,
        notificationDispatchJobs: [] as never,
        liveSessions: [
          {
            id: 'session-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            provider: 'daily',
            session_scope_key: 'channel:channel-1',
            status: 'live',
            started_by_profile_id: 'profile-educator-1',
            join_path: '/join/1',
            started_at: '2026-03-14T10:00:00.000Z',
            ended_at: '2026-03-14T11:00:00.000Z',
            created_at: '2026-03-14T10:00:00.000Z',
            updated_at: '2026-03-14T11:00:00.000Z',
          },
        ] as never,
        liveSessionParticipants: [] as never,
      },
      { now },
    );

    expect(
      dashboard.monthlyCompletedSessions.find((point) => point.label === 'Mar 2026')
        ?.value,
    ).toBe(1);
    expect(
      dashboard.summary.find((metric) => metric.key === 'completed-sessions-this-month')
        ?.value,
    ).toBe(0);
    expect(dashboard.userSummary).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'educators', value: 1 })]),
    );
    expect(dashboard.completedSessionsByTeacher[0]).toMatchObject({
      label: 'Taylor Reed',
      value: 1,
    });
  });
});
