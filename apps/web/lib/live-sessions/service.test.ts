import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(),
  getProfilesByIds: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/live-sessions/scope', () => ({
  resolveChannelLiveSessionScope: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: vi.fn(),
}));

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getProfileByAccountId,
  getProfilesByIds,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import { createOrJoinLiveSession } from '@iconicedu/web/lib/live-sessions/service';

function createServiceSupabaseStub() {
  let liveSessionRow: Record<string, unknown> | null = null;
  let startedMessageId: string | null = null;
  let participantUpserted = false;
  let expectedParticipantsInserted = 0;
  const participantEvents: Array<Record<string, unknown>> = [];

  return {
    state: {
      get liveSessionRow() {
        return liveSessionRow;
      },
      get startedMessageId() {
        return startedMessageId;
      },
      get participantUpserted() {
        return participantUpserted;
      },
      get expectedParticipantsInserted() {
        return expectedParticipantsInserted;
      },
      get participantEvents() {
        return participantEvents;
      },
    },
    from(table: string) {
      if (table === 'channels') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          maybeSingle: async () => ({
            data: {
              id: 'channel-1',
              org_id: 'org-1',
              kind: 'channel',
              topic: 'Math',
              purpose: 'learning-space',
              live_session_config: {
                enabled: true,
                provider: 'custom',
                mode: 'video',
                joinUrl: 'https://meet.example.com/custom-room',
              },
            },
            error: null,
          }),
        };
      }

      if (table === 'channel_members') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          returns: async () => ({
            data: [{ profile_id: 'profile-1' }],
            error: null,
          }),
          is() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: 'member-1' }, error: null }),
        };
      }

      if (table === 'channel_live_sessions') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          is() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
          insert(payload: Record<string, unknown>) {
            liveSessionRow = {
              id: 'live-session-1',
              org_id: payload.org_id,
              channel_id: payload.channel_id,
              provider: payload.provider,
              provider_session_id: null,
              session_scope_key: payload.session_scope_key,
              occurrence_key: payload.occurrence_key,
              status: payload.status,
              started_by_profile_id: payload.started_by_profile_id,
              started_message_id: null,
              join_path: payload.join_path,
              started_at: payload.started_at,
              provider_metadata: {},
              app_metadata: {},
            };
            return {
              select() {
                return this;
              },
              single: async () => ({ data: liveSessionRow, error: null }),
            };
          },
          update(payload: Record<string, unknown>) {
            liveSessionRow = {
              ...(liveSessionRow ?? {}),
              ...payload,
            };
            return {
              eq() {
                return this;
              },
              select() {
                return this;
              },
              single: async () => ({ data: liveSessionRow, error: null }),
            };
          },
        };
      }

      if (table === 'profiles') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: 'system-profile-1' }, error: null }),
        };
      }

      if (table === 'messages') {
        return {
          insert() {
            return {
              select() {
                return this;
              },
              single: async () => ({ data: { id: 'message-1' }, error: null }),
            };
          },
        };
      }

      if (table === 'message_live_session_started') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            startedMessageId = String(payload.message_id);
            return { error: null };
          },
        };
      }

      if (table === 'channel_live_session_participants') {
        return {
          upsert() {
            participantUpserted = true;
            return {
              select() {
                return this;
              },
              maybeSingle: async () => ({ data: { id: 'participant-1' }, error: null }),
            };
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({ data: [], error: null }),
        };
      }

      if (table === 'channel_live_session_expected_participants') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({ data: [], error: null }),
          insert: async (payload: Array<Record<string, unknown>>) => {
            expectedParticipantsInserted = payload.length;
            return { error: null };
          },
        };
      }

      if (table === 'channel_live_session_participant_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            participantEvents.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unhandled table stub: ${table}`);
    },
  };
}

describe('createOrJoinLiveSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountByAuthUserId).mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
      error: null,
    } as never);

    vi.mocked(getProfileByAccountId).mockResolvedValue({
      data: {
        id: 'profile-1',
        display_name: 'Taylor Reed',
        first_name: 'Taylor',
        last_name: 'Reed',
      },
      error: null,
    } as never);

    vi.mocked(getProfilesByIds).mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          display_name: 'Taylor Reed',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    } as never);

    vi.mocked(resolveChannelLiveSessionScope).mockResolvedValue({
      scopeKey: 'channel:channel-1',
      occurrenceKey: '2026-03-02T10:00:00.000Z',
      occurrenceLabel: 'Mar 2, 10:00 AM',
      occurrenceEndAt: '2026-03-02T11:00:00.000Z',
    });
  });

  it('creates a live session and started message for custom external providers', async () => {
    const serviceSupabase = createServiceSupabaseStub();

    const result = await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
    });

    expect(result).toEqual({
      sessionId: 'live-session-1',
      joinPath: 'https://meet.example.com/custom-room',
      status: 'live',
      created: true,
      provider: 'custom',
    });

    expect(serviceSupabase.state.liveSessionRow).toMatchObject({
      id: 'live-session-1',
      provider: 'custom',
      status: 'live',
      join_path: 'https://meet.example.com/custom-room',
      started_message_id: 'message-1',
    });
    expect(serviceSupabase.state.startedMessageId).toBe('message-1');
    expect(serviceSupabase.state.participantUpserted).toBe(true);
    expect(serviceSupabase.state.expectedParticipantsInserted).toBe(1);
    expect(serviceSupabase.state.participantEvents).toHaveLength(2);
    expect(
      serviceSupabase.state.participantEvents.map((event) => event.event_type),
    ).toEqual(['session_started', 'join_requested']);
    expect(vi.mocked(publishActivityEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.started',
        payload: expect.objectContaining({
          title: 'Math',
          occurrenceStart: '2026-03-02T10:00:00.000Z',
          participants: [
            expect.objectContaining({
              profileId: 'profile-1',
              displayName: 'Taylor Reed',
            }),
          ],
        }),
      }),
    );
  });
});
