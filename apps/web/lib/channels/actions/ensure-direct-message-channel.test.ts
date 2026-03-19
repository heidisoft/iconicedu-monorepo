/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

const getChannelByDmKey = vi.fn();
const createSupabaseServiceClient = vi.fn();

vi.mock('@iconicedu/web/lib/channels/queries/channels.query', () => ({
  getChannelByDmKey: (...args: unknown[]) => getChannelByDmKey(...args),
}));
vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClient(...args),
}));

const { ensureDirectMessageChannel } =
  await import('@iconicedu/web/lib/channels/actions/ensure-direct-message-channel');

describe('ensureDirectMessageChannel', () => {
  it('returns existing channel when channel insert hits dm unique conflict', async () => {
    getChannelByDmKey
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'channel-existing' } });

    const insert = vi.fn().mockResolvedValueOnce({
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "channels_org_dm_key_uniq"',
      },
    });
    const supabase = { from: vi.fn(() => ({ insert })) } as any;

    const result = await ensureDirectMessageChannel(
      supabase,
      'org-1',
      'profile-1',
      'profile-2',
    );

    expect(result).toEqual({
      channelId: 'channel-existing',
      dmKey: 'dm:profile-1-profile-2',
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('falls back to service client when member insert is blocked by RLS', async () => {
    getChannelByDmKey.mockResolvedValueOnce({ data: null });

    const userInsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: {
          code: '42501',
          message:
            'new row violates row-level security policy for table "channel_members"',
        },
      });
    const supabase = { from: vi.fn(() => ({ insert: userInsert })) } as any;

    const serviceInsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'channel-created',
        org_id: 'org-1',
        kind: 'dm',
        created_by_profile_id: 'profile-1',
        deleted_at: null,
      },
      error: null,
    });
    const serviceSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'channels') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          };
        }
        if (table === 'channel_members') {
          return { insert: serviceInsert };
        }
        return { insert: vi.fn() };
      }),
    };
    createSupabaseServiceClient.mockReturnValue(serviceSupabase);

    const result = await ensureDirectMessageChannel(
      supabase,
      'org-1',
      'profile-1',
      'profile-2',
    );

    expect(result.dmKey).toBe('dm:profile-1-profile-2');
    expect(createSupabaseServiceClient).toHaveBeenCalledTimes(1);
    expect(serviceInsert).toHaveBeenCalledTimes(1);
  });

  it('returns existing channel when dm_key exists', async () => {
    getChannelByDmKey.mockResolvedValueOnce({ data: { id: 'channel-1' } });
    const supabase = { from: vi.fn() } as any;

    const result = await ensureDirectMessageChannel(
      supabase,
      'org-1',
      'profile-1',
      'profile-2',
    );

    expect(result).toEqual({
      channelId: 'channel-1',
      dmKey: 'dm:profile-1-profile-2',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('creates a new channel when dm_key does not exist', async () => {
    getChannelByDmKey.mockResolvedValueOnce({ data: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) } as any;
    const result = await ensureDirectMessageChannel(
      supabase,
      'org-1',
      'profile-1',
      'profile-2',
    );

    expect(typeof result.channelId).toBe('string');
    expect(result.dmKey).toBe('dm:profile-1-profile-2');
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
