import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import {
  hashMeetingLink,
  issueMeetingLink,
  resolveMeetingLink,
  redeemMeetingHandoff,
} from './meeting-browser-links';
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
describe('meeting-scoped browser capabilities', () => {
  let query: Record<string, jest.Mock>;
  const rpc = jest.fn();
  beforeEach(() => {
    rpc.mockReset();
    query = {};
    for (const method of ['insert', 'select', 'eq', 'gt', 'delete'])
      query[method] = jest.fn().mockReturnValue(query);
    query.then = jest.fn((resolve) => Promise.resolve({ error: null }).then(resolve));
    query.maybeSingle = jest.fn();
    jest
      .mocked(createSupabaseServiceClient)
      .mockReturnValue({ from: jest.fn(() => query), rpc } as never);
  });
  it('stores only a hash and issues a 60-second personal handoff', async () => {
    const before = Date.now();
    const token = await issueMeetingLink('session', 'handoff', 'user');
    expect(token).toMatch(/^[\w-]{32}$/);
    const row = query.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      token_hash: hashMeetingLink(token),
      live_session_id: 'session',
      auth_user_id: 'user',
      purpose: 'handoff',
    });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(new Date(row.expires_at).getTime() - before).toBeLessThanOrEqual(61_000);
  });
  it('invitation tokens carry no sender identity and are bound to the current passcode', async () => {
    await issueMeetingLink('session', 'invite', null, 'synthetic-passcode');
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: null,
        passcode_hash: hashMeetingLink('synthetic-passcode'),
      }),
    );
  });
  it('requires meeting scope, expiry and an unchanged passcode', async () => {
    query.maybeSingle.mockResolvedValue({
      data: { purpose: 'invite', passcode_hash: hashMeetingLink('old') },
      error: null,
    });
    await expect(resolveMeetingLink('a'.repeat(32), 'session', 'new')).rejects.toThrow(
      'Invalid or expired',
    );
    expect(query.eq).toHaveBeenCalledWith('live_session_id', 'session');
    expect(query.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
  });
  it('never accepts a handoff as a reusable meeting credential', async () => {
    query.maybeSingle.mockResolvedValue({ data: { purpose: 'handoff' }, error: null });
    await expect(resolveMeetingLink('a'.repeat(32), 'session', null)).rejects.toThrow(
      'Invalid or expired',
    );
  });
  it('retries redemption with the same access token and browser key', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const token = await redeemMeetingHandoff('a'.repeat(32), 'session', 'b'.repeat(32));
    expect(await redeemMeetingHandoff('a'.repeat(32), 'session', 'b'.repeat(32))).toBe(
      token,
    );
    expect(token).toMatch(/^[\w-]{32}$/);
    expect(rpc).toHaveBeenCalledWith(
      'redeem_meeting_browser_handoff',
      expect.objectContaining({
        p_token_hash: hashMeetingLink('a'.repeat(32)),
        p_redemption_hash: hashMeetingLink('b'.repeat(32)),
        p_access_hash: hashMeetingLink(token),
      }),
    );
    expect(query.delete).not.toHaveBeenCalled();
  });
  it('rejects expired or differently-bound handoffs', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      redeemMeetingHandoff('a'.repeat(32), 'session', 'c'.repeat(32)),
    ).rejects.toThrow('Invalid or expired');
  });
  it('does not consume a handoff when its transaction fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'storage unavailable' } });
    await expect(
      redeemMeetingHandoff('a'.repeat(32), 'session', 'b'.repeat(32)),
    ).rejects.toThrow('Unable to open');
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(
      redeemMeetingHandoff('a'.repeat(32), 'session', 'b'.repeat(32)),
    ).resolves.toMatch(/^[\w-]{32}$/);
  });
});
