import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { requireMeetingAdmission, meetingAdmissionStatus } from './meeting-admissions';
import { hashMeetingLink } from './meeting-browser-links';
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
describe('server-enforced admission', () => {
  const rpc = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ rpc } as never);
  });
  it('returns waiting without provider credentials and hashes browser and identity secrets', async () => {
    rpc.mockResolvedValue({ data: 'waiting', error: null });
    try {
      await requireMeetingAdmission(
        'session',
        'a'.repeat(32),
        'verified-user:child',
        'Student',
      );
      throw new Error('Expected waiting');
    } catch (error) {
      expect((error as { getResponse: () => unknown }).getResponse()).toEqual({
        message: expect.any(String),
        admission: { token: 'a'.repeat(32), status: 'waiting' },
      });
    }
    expect(rpc).toHaveBeenCalledWith('request_meeting_admission', {
      p_session: 'session',
      p_token_hash: hashMeetingLink('a'.repeat(32)),
      p_identity_hash: hashMeetingLink('verified-user:child'),
      p_name: 'Student',
    });
  });
  it('allows only an approved request through', async () => {
    rpc.mockResolvedValue({ data: 'approved', error: null });
    await expect(
      requireMeetingAdmission('session', 'a'.repeat(32), 'identity', 'Student'),
    ).resolves.toBeUndefined();
  });
  it.each(['denied', 'ended', null])('fails closed for %s', async (status) => {
    rpc.mockResolvedValue({ data: status, error: null });
    await expect(
      requireMeetingAdmission('session', 'a'.repeat(32), 'identity', 'Student'),
    ).rejects.toThrow('declined or expired');
  });
  it('fails closed on database errors', async () => {
    rpc.mockResolvedValue({ error: { message: 'unavailable' } });
    await expect(
      requireMeetingAdmission('session', 'a'.repeat(32), 'identity', 'Student'),
    ).rejects.toThrow('Unable to request');
  });
  it('rejects malformed capabilities without a database call', async () => {
    await expect(
      requireMeetingAdmission('session', 'invalid', 'identity', 'Student'),
    ).rejects.toThrow('Admission token');
    await expect(meetingAdmissionStatus('session', 'invalid')).rejects.toThrow(
      'Invalid admission',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
