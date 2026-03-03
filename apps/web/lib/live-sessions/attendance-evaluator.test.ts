import { describe, expect, it } from 'vitest';

import { __test__ } from '@iconicedu/web/lib/live-sessions/attendance-evaluator';

describe('attendance-evaluator', () => {
  it('uses the shorter of scheduled and actual session duration for scheduled sessions', () => {
    expect(
      __test__.calculateRequiredSeconds({
        id: 'session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        session_scope_key: 'occurrence:1',
        occurrence_key: '2026-03-02T10:00:00.000Z',
        status: 'ended',
        started_by_profile_id: 'profile-1',
        join_path: '/session-1',
        started_at: '2026-03-02T10:00:00.000Z',
        ended_at: '2026-03-02T10:50:00.000Z',
        app_metadata: {
          occurrenceEndAt: '2026-03-02T11:00:00.000Z',
        },
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-02T10:50:00.000Z',
      } as never),
    ).toBe(3000);
  });

  it('counts open joined intervals through session end', () => {
    expect(
      __test__.calculateCreditedSeconds(
        {
          id: 'participant-1',
          org_id: 'org-1',
          live_session_id: 'session-1',
          channel_id: 'channel-1',
          profile_id: 'profile-1',
          total_seconds: 600,
          last_known_status: 'joined',
          last_joined_at: '2026-03-02T10:40:00.000Z',
          created_at: '2026-03-02T10:00:00.000Z',
          updated_at: '2026-03-02T10:40:00.000Z',
        } as never,
        {
          id: 'session-1',
          org_id: 'org-1',
          channel_id: 'channel-1',
          provider: 'daily',
          session_scope_key: 'occurrence:1',
          status: 'ended',
          started_by_profile_id: 'profile-1',
          join_path: '/session-1',
          started_at: '2026-03-02T10:00:00.000Z',
          ended_at: '2026-03-02T11:00:00.000Z',
          created_at: '2026-03-02T10:00:00.000Z',
          updated_at: '2026-03-02T11:00:00.000Z',
        } as never,
      ),
    ).toBe(1800);
  });

  it('marks expected non-attendees as no-show and threshold attendees as full', () => {
    const noShow = __test__.evaluateParticipant({
      participant: {
        id: 'participant-1',
        org_id: 'org-1',
        live_session_id: 'session-1',
        channel_id: 'channel-1',
        profile_id: 'profile-1',
        expected_to_attend: true,
        join_count: 0,
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-02T10:00:00.000Z',
      } as never,
      expectedProfileIds: new Set(['profile-1']),
      session: {
        id: 'session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        session_scope_key: 'occurrence:1',
        occurrence_key: '2026-03-02T10:00:00.000Z',
        status: 'ended',
        started_by_profile_id: 'profile-1',
        join_path: '/session-1',
        started_at: '2026-03-02T10:00:00.000Z',
        ended_at: '2026-03-02T11:00:00.000Z',
        app_metadata: { occurrenceEndAt: '2026-03-02T11:00:00.000Z' },
        attendance_policy: __test__.defaultAttendancePolicy,
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-02T11:00:00.000Z',
      } as never,
    });

    const full = __test__.evaluateParticipant({
      participant: {
        id: 'participant-2',
        org_id: 'org-1',
        live_session_id: 'session-1',
        channel_id: 'channel-1',
        profile_id: 'profile-2',
        expected_to_attend: true,
        first_joined_at: '2026-03-02T10:00:00.000Z',
        total_seconds: 3300,
        join_count: 1,
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-02T10:55:00.000Z',
      } as never,
      expectedProfileIds: new Set(['profile-2']),
      session: {
        id: 'session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        session_scope_key: 'occurrence:1',
        occurrence_key: '2026-03-02T10:00:00.000Z',
        status: 'ended',
        started_by_profile_id: 'profile-1',
        join_path: '/session-1',
        started_at: '2026-03-02T10:00:00.000Z',
        ended_at: '2026-03-02T11:00:00.000Z',
        app_metadata: { occurrenceEndAt: '2026-03-02T11:00:00.000Z' },
        attendance_policy: __test__.defaultAttendancePolicy,
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-02T11:00:00.000Z',
      } as never,
    });

    expect(noShow.attendanceStatus).toBe('no_show');
    expect(full.attendanceStatus).toBe('full');
    expect(full.qualifiedFullAttendance).toBe(true);
  });
});
