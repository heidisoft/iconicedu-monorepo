import { describe, expect, it, vi } from 'vitest';

import {
  getLiveSessionAttendanceDetailRows,
  listLiveSessionAttendanceRows,
} from '@iconicedu/web/lib/admin/live-session-attendance.query';

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: vi.fn(),
}));

import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

function createQuerySupabaseStub() {
  const calls: string[] = [];

  return {
    calls,
    from(table: string) {
      calls.push(table);

      if (table === 'channel_live_sessions') {
        return {
          select() { return this; },
          eq() { return this; },
          is() { return this; },
          order() { return this; },
          gte() { return this; },
          lte() { return this; },
          returns: async () => ({
            data: [{
              id: 'session-1',
              org_id: 'org-1',
              channel_id: 'channel-1',
              provider: 'daily',
              session_scope_key: 'channel:channel-1',
              status: 'ended',
              started_by_profile_id: 'profile-1',
              join_path: '/iconic-academy/live-sessions/session-1',
              started_at: '2026-03-02T10:00:00.000Z',
              ended_at: '2026-03-02T11:00:00.000Z',
              created_at: '2026-03-02T10:00:00.000Z',
              updated_at: '2026-03-02T11:00:00.000Z',
            }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: {
              id: 'session-1',
              org_id: 'org-1',
              channel_id: 'channel-1',
              provider: 'daily',
              session_scope_key: 'channel:channel-1',
              status: 'ended',
              started_by_profile_id: 'profile-1',
              join_path: '/iconic-academy/live-sessions/session-1',
              started_at: '2026-03-02T10:00:00.000Z',
              ended_at: '2026-03-02T11:00:00.000Z',
              created_at: '2026-03-02T10:00:00.000Z',
              updated_at: '2026-03-02T11:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (table === 'channels') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          is() { return this; },
          returns: async () => ({
            data: [{
              id: 'channel-1',
              org_id: 'org-1',
              kind: 'channel',
              topic: 'Algebra 1',
              visibility: 'private',
              purpose: 'learning-space',
              status: 'active',
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: {
              id: 'channel-1',
              org_id: 'org-1',
              kind: 'channel',
              topic: 'Algebra 1',
              visibility: 'private',
              purpose: 'learning-space',
              status: 'active',
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (table === 'learning_space_channels') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          is() { return this; },
          returns: async () => ({
            data: [{
              id: 'link-1',
              org_id: 'org-1',
              learning_space_id: 'space-1',
              channel_id: 'channel-1',
              is_primary: true,
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: {
              id: 'link-1',
              org_id: 'org-1',
              learning_space_id: 'space-1',
              channel_id: 'channel-1',
              is_primary: true,
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (table === 'learning_spaces') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          is() { return this; },
          returns: async () => ({
            data: [{
              id: 'space-1',
              org_id: 'org-1',
              kind: 'one_on_one',
              status: 'active',
              title: 'Algebra tutoring',
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: {
              id: 'space-1',
              org_id: 'org-1',
              kind: 'one_on_one',
              status: 'active',
              title: 'Algebra tutoring',
              created_at: '2026-03-01T10:00:00.000Z',
              updated_at: '2026-03-01T10:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (table === 'channel_live_session_participants') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          is() { return this; },
          returns: async () => ({
            data: [{
              id: 'participant-1',
              org_id: 'org-1',
              live_session_id: 'session-1',
              channel_id: 'channel-1',
              profile_id: 'profile-1',
              join_requested_at: '2026-03-02T09:59:00.000Z',
              first_joined_at: '2026-03-02T10:00:10.000Z',
              join_count: 1,
              last_known_status: 'joined',
              created_at: '2026-03-02T10:00:00.000Z',
              updated_at: '2026-03-02T10:10:00.000Z',
            }],
            error: null,
          }),
        };
      }

      throw new Error(`Unhandled table: ${table}`);
    },
  };
}

describe('live-session-attendance.query', () => {
  it('loads list rows and fans out to related tables', async () => {
    vi.mocked(getProfilesByIds).mockResolvedValue({
      data: [{
        id: 'profile-1',
        org_id: 'org-1',
        account_id: 'account-1',
        kind: 'educator',
        display_name: 'Taylor Reed',
        first_name: 'Taylor',
        last_name: 'Reed',
        avatar_source: 'uploaded',
        avatar_url: null,
        avatar_seed: 'seed',
        timezone: 'UTC',
        locale: 'en',
        status: 'active',
        created_at: '2026-03-01T10:00:00.000Z',
        updated_at: '2026-03-01T10:00:00.000Z',
      }],
      error: null,
    } as never);

    const supabase = createQuerySupabaseStub();
    const result = await listLiveSessionAttendanceRows(supabase as never, 'org-1');

    expect(result.sessions).toHaveLength(1);
    expect(result.channels[0]?.topic).toBe('Algebra 1');
    expect(result.learningSpaces[0]?.title).toBe('Algebra tutoring');
    expect(getProfilesByIds).toHaveBeenCalledWith(expect.anything(), 'org-1', ['profile-1']);
  });

  it('loads detail rows for a specific live session', async () => {
    vi.mocked(getProfilesByIds).mockResolvedValue({
      data: [{
        id: 'profile-1',
        org_id: 'org-1',
        account_id: 'account-1',
        kind: 'educator',
        display_name: 'Taylor Reed',
        first_name: 'Taylor',
        last_name: 'Reed',
        avatar_source: 'uploaded',
        avatar_url: null,
        avatar_seed: 'seed',
        timezone: 'UTC',
        locale: 'en',
        status: 'active',
        created_at: '2026-03-01T10:00:00.000Z',
        updated_at: '2026-03-01T10:00:00.000Z',
      }],
      error: null,
    } as never);

    const supabase = createQuerySupabaseStub();
    const result = await getLiveSessionAttendanceDetailRows(
      supabase as never,
      'org-1',
      'session-1',
    );

    expect(result.session?.id).toBe('session-1');
    expect(result.channel?.topic).toBe('Algebra 1');
    expect(result.learningSpace?.title).toBe('Algebra tutoring');
    expect(result.starterProfile?.id).toBe('profile-1');
  });
});
