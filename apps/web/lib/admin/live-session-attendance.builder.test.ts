import { describe, expect, it } from 'vitest';

import {
  buildLiveSessionAttendanceDetailVM,
  buildLiveSessionAttendanceListItemVM,
} from '@iconicedu/web/lib/admin/live-session-attendance.builder';

describe('live-session-attendance.builder', () => {
  const session = {
    id: 'session-1',
    org_id: 'org-1',
    channel_id: 'channel-1',
    provider: 'daily',
    session_scope_key: 'channel:channel-1',
    occurrence_key: '2026-03-02T10:00:00.000Z',
    status: 'ended',
    started_by_profile_id: 'profile-1',
    join_path: '/iconic-academy/live-sessions/session-1',
    started_at: '2026-03-02T10:00:00.000Z',
    ended_at: '2026-03-02T11:00:00.000Z',
    expected_participant_count: 2,
    attendee_count: 1,
    full_attendance_count: 1,
    partial_attendance_count: 0,
    no_show_count: 1,
    session_duration_seconds: 3600,
    report_generated_at: '2026-03-02T11:00:01.000Z',
    attendance_policy: {
      fullAttendanceThresholdPercent: 90,
      graceSeconds: 0,
      countLateJoinAsAttended: true,
      countRejoins: true,
      source: 'hybrid',
    },
    created_at: '2026-03-02T10:00:00.000Z',
    updated_at: '2026-03-02T11:00:00.000Z',
  };

  const channel = {
    id: 'channel-1',
    org_id: 'org-1',
    kind: 'channel',
    topic: 'Algebra 1',
    visibility: 'private',
    purpose: 'learning-space',
    status: 'active',
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  };

  const learningSpaceLink = {
    id: 'link-1',
    org_id: 'org-1',
    learning_space_id: 'space-1',
    channel_id: 'channel-1',
    is_primary: true,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  };

  const learningSpace = {
    id: 'space-1',
    org_id: 'org-1',
    kind: 'one_on_one',
    status: 'active',
    title: 'Algebra tutoring',
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  };

  const starterProfile = {
    id: 'profile-1',
    org_id: 'org-1',
    account_id: 'account-1',
    kind: 'educator',
    display_name: 'Taylor Reed',
    first_name: 'Taylor',
    last_name: 'Reed',
    avatar_source: 'uploaded',
    avatar_url: 'https://example.com/avatar.jpg',
    avatar_seed: 'seed',
    timezone: 'UTC',
    locale: 'en',
    status: 'active',
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  };

  it('builds a list item with derived attendance metrics', () => {
    const vm = buildLiveSessionAttendanceListItemVM({
      session: session as never,
      channel: channel as never,
      learningSpaceLink: learningSpaceLink as never,
      learningSpace: learningSpace as never,
      starterProfile: starterProfile as never,
      participants: [
        {
          id: 'p-1',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-1',
          join_requested_at: '2026-03-02T09:59:00.000Z',
          first_joined_at: '2026-03-02T10:00:10.000Z',
          last_left_at: '2026-03-02T10:59:00.000Z',
          join_count: 1,
          total_seconds: 3530,
          expected_to_attend: true,
          attendance_status: 'full',
          attendance_ratio: 0.98055,
          qualified_full_attendance: true,
          required_seconds: 3600,
          credited_seconds: 3530,
          last_known_status: 'left',
          created_at: '2026-03-02T10:00:00.000Z',
          updated_at: '2026-03-02T10:59:00.000Z',
        },
        {
          id: 'p-2',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-2',
          join_requested_at: '2026-03-02T10:02:00.000Z',
          join_count: 0,
          expected_to_attend: true,
          attendance_status: 'no_show',
          attendance_ratio: 0,
          qualified_full_attendance: false,
          required_seconds: 3600,
          credited_seconds: 0,
          last_known_status: 'requested',
          created_at: '2026-03-02T10:02:00.000Z',
          updated_at: '2026-03-02T10:02:00.000Z',
        },
      ] as never,
    });

    expect(vm.scope).toBe('scheduled');
    expect(vm.learningSpaceTitle).toBe('Algebra tutoring');
    expect(vm.metrics).toEqual({
      participantCount: 2,
      expectedParticipantCount: 2,
      attendeeCount: 1,
      fullAttendanceCount: 1,
      partialAttendanceCount: 0,
      noShowCount: 1,
      attendanceRate: 0.5,
      fullAttendanceRate: 0.5,
      averageAttendanceSeconds: 3530,
      durationSeconds: 3600,
    });
    expect(vm.startedBy?.profile.displayName).toBe('Taylor Reed');
    expect(vm.reportGeneratedAt).toBe('2026-03-02T11:00:01.000Z');
  });

  it('builds detail rows with attended and no-show flags', () => {
    const vm = buildLiveSessionAttendanceDetailVM({
      session: session as never,
      channel: channel as never,
      learningSpaceLink: learningSpaceLink as never,
      learningSpace: learningSpace as never,
      starterProfile: starterProfile as never,
      profiles: [
        starterProfile,
        {
          ...starterProfile,
          id: 'profile-2',
          account_id: 'account-2',
          kind: 'child',
          display_name: 'Nia Bennett',
          first_name: 'Nia',
          last_name: 'Bennett',
        },
      ] as never,
      participants: [
        {
          id: 'p-1',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-1',
          join_requested_at: '2026-03-02T09:59:00.000Z',
          first_joined_at: '2026-03-02T10:00:10.000Z',
          last_left_at: '2026-03-02T10:59:00.000Z',
          join_count: 1,
          total_seconds: 3530,
          expected_to_attend: true,
          attendance_status: 'full',
          attendance_ratio: 0.98055,
          qualified_full_attendance: true,
          required_seconds: 3600,
          credited_seconds: 3530,
          last_known_status: 'left',
          created_at: '2026-03-02T10:00:00.000Z',
          updated_at: '2026-03-02T10:59:00.000Z',
        },
        {
          id: 'p-2',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-2',
          join_requested_at: '2026-03-02T10:02:00.000Z',
          join_count: 0,
          expected_to_attend: true,
          attendance_status: 'no_show',
          attendance_ratio: 0,
          qualified_full_attendance: false,
          required_seconds: 3600,
          credited_seconds: 0,
          last_known_status: 'requested',
          created_at: '2026-03-02T10:02:00.000Z',
          updated_at: '2026-03-02T10:02:00.000Z',
        },
      ] as never,
      events: [
        {
          id: 'event-1',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-1',
          provider: 'daily',
          event_type: 'participant_joined',
          occurred_at: '2026-03-02T10:00:10.000Z',
          source: 'provider_webhook',
          created_at: '2026-03-02T10:00:10.000Z',
          updated_at: '2026-03-02T10:00:10.000Z',
        },
      ] as never,
    });

    expect(vm.participants).toHaveLength(2);
    expect(vm.participants[0]?.attended).toBe(true);
    expect(vm.participants[1]?.noShow).toBe(true);
    expect(vm.participants[1]?.participant?.profile.displayName).toBe('Nia Bennett');
    expect(vm.policy.fullAttendanceThresholdPercent).toBe(90);
    expect(vm.timeline?.[0]?.eventType).toBe('participant_joined');
  });
});
