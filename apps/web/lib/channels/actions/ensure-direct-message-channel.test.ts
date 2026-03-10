/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

const getChannelByDmKey = vi.fn();

vi.mock('@iconicedu/web/lib/channels/queries/channels.query', () => ({
  getChannelByDmKey: (...args: unknown[]) => getChannelByDmKey(...args),
}));

const { ensureDirectMessageChannel } =
  await import('@iconicedu/web/lib/channels/actions/ensure-direct-message-channel');

describe('ensureDirectMessageChannel', () => {
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
