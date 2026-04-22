import { resolveActiveConversationSuppressedRecipients } from './active-conversation-suppression';
import type { ActivityEventRow } from '@iconicedu/shared-types';

type FilterMap = Record<string, unknown>;

function createSupabaseMock(options: {
  profiles?: Array<{ id: string; account_id: string | null }>;
  presence?: Array<{
    profile_id: string;
    live_status: string | null;
    last_seen_at: string | null;
  }>;
  readState?: Array<{ account_id: string; last_read_at: string | null }>;
}) {
  const readStateFilters: FilterMap = {};

  return {
    readStateFilters,
    client: {
      from(table: string) {
        const filters: FilterMap = {};
        const chain = {
          select() {
            return chain;
          },
          eq(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          in(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          is(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          returns() {
            if (table === 'profiles') {
              return Promise.resolve({ data: options.profiles ?? [], error: null });
            }
            if (table === 'profile_presence') {
              return Promise.resolve({ data: options.presence ?? [], error: null });
            }
            if (table === 'channel_read_state') {
              Object.assign(readStateFilters, filters);
              return Promise.resolve({ data: options.readState ?? [], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
        };

        return chain;
      },
    },
  };
}

const baseEvent: ActivityEventRow = {
  id: 'event-1',
  org_id: 'org-1',
  event_type: 'message.posted',
  occurred_at: '2026-04-21T12:00:00.000Z',
  payload: { channelId: 'channel-1' },
  scope: { kind: 'channel', channelId: 'channel-1' },
} as ActivityEventRow;

describe('resolveActiveConversationSuppressedRecipients', () => {
  it('queries thread-level read state for thread reply events', async () => {
    const { client, readStateFilters } = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'online',
          last_seen_at: '2026-04-21T11:59:30.000Z',
        },
      ],
      readState: [{ account_id: 'account-1', last_read_at: '2026-04-21T11:59:50.000Z' }],
    });

    await resolveActiveConversationSuppressedRecipients({
      supabase: client as never,
      event: {
        ...baseEvent,
        payload: { channelId: 'channel-1', threadId: 'thread-1' },
      },
      recipientProfileIds: ['profile-1'],
      now: '2026-04-21T12:00:00.000Z',
    });

    expect(readStateFilters['thread_id']).toBe('thread-1');
  });

  it('queries channel-level read state for non-thread events', async () => {
    const { client, readStateFilters } = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'online',
          last_seen_at: '2026-04-21T11:59:30.000Z',
        },
      ],
      readState: [{ account_id: 'account-1', last_read_at: '2026-04-21T11:59:50.000Z' }],
    });

    await resolveActiveConversationSuppressedRecipients({
      supabase: client as never,
      event: baseEvent,
      recipientProfileIds: ['profile-1'],
      now: '2026-04-21T12:00:00.000Z',
    });

    expect(readStateFilters['thread_id']).toBeNull();
  });
});
