import { describe, expect, it, vi } from 'vitest';

import { buildThreadById } from '@iconicedu/web/lib/messages/builders/thread.builder';

const getThreadById = vi.fn();
const getThreadParticipantsByThreadIds = vi.fn();
const getThreadReadStatesByAccountId = vi.fn();
const buildUserProfilesByIds = vi.fn();
const mapThreadRowToVM = vi.fn();

vi.mock('@iconicedu/web/lib/messages/queries/messages.query', () => ({
  getThreadById: (...args: unknown[]) => getThreadById(...args),
  getThreadsByChannelId: vi.fn(async () => ({ data: [] })),
  getThreadParticipantsByThreadIds: (...args: unknown[]) =>
    getThreadParticipantsByThreadIds(...args),
  getThreadReadStatesByAccountId: (...args: unknown[]) =>
    getThreadReadStatesByAccountId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfilesByIds: (...args: unknown[]) => buildUserProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/messages/mappers/thread.mapper', () => ({
  mapThreadRowToVM: (...args: unknown[]) => mapThreadRowToVM(...args),
}));

describe('buildThreadById', () => {
  const supabase = {} as Parameters<typeof buildThreadById>[0];

  it('returns null when thread is missing', async () => {
    getThreadById.mockResolvedValueOnce({ data: null });

    const result = await buildThreadById(supabase, 'org-1', 'thread-1');

    expect(result).toBeNull();
  });

  it('maps a thread with participants', async () => {
    getThreadById.mockResolvedValueOnce({
      data: {
        id: 'thread-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        parent_message_id: 'message-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    getThreadParticipantsByThreadIds.mockResolvedValueOnce({
      data: [{ thread_id: 'thread-1', profile_id: 'profile-1' }],
    });
    getThreadReadStatesByAccountId.mockResolvedValueOnce({ data: [] });
    buildUserProfilesByIds.mockResolvedValueOnce(
      new Map([
        [
          'profile-1',
          {
            ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
            profile: { displayName: 'User 1', avatar: { url: null, source: 'seed' } },
            prefs: {},
            meta: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            kind: 'guardian',
          },
        ],
      ]),
    );
    mapThreadRowToVM.mockReturnValueOnce({ ids: { id: 'thread-1', orgId: 'org-1' } });

    const result = await buildThreadById(supabase, 'org-1', 'thread-1');

    expect(mapThreadRowToVM).toHaveBeenCalled();
    expect(result).toEqual({ ids: { id: 'thread-1', orgId: 'org-1' } });
  });
});
