import { redirectClassroomLink } from './incoming-link';
import { rememberNativeInvitation } from './link-recovery';
import { publicApiPost } from '@/lib/api/http-client';
jest.mock('./link-recovery', () => ({
  rememberNativeInvitation: jest.fn(),
  nativeHandoffRedemptionKey: jest.fn().mockResolvedValue('synthetic-redemption-key'),
}));
jest.mock('@/lib/api/http-client', () => ({ publicApiPost: jest.fn() }));
describe('incoming classroom links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  });
  it.each([
    'https://app.invalid/live/aaaa-bbbb#invite=synthetic',
    'iconicedu://live/aaaa-bbbb#invite=synthetic',
    '/live/aaaa-bbbb#invite=synthetic',
  ])('persists capability before routing %s', async (path) => {
    expect(await redirectClassroomLink(path)).toMatch(
      /^\/classroom\/aaaa-bbbb\?entry=[\d-]+$/,
    );
    expect(rememberNativeInvitation).toHaveBeenCalledWith('aaaa-bbbb', 'synthetic');
  });
  it('supports plain links without forcing login or joining immediately', async () => {
    expect(await redirectClassroomLink('https://app.invalid/live/aaaa')).toMatch(
      /^\/classroom\/aaaa\?entry=[\d-]+$/,
    );
    expect(rememberNativeInvitation).not.toHaveBeenCalled();
  });
  it('does not trust other origins', async () => {
    expect(await redirectClassroomLink('https://evil.invalid/live/aaaa#invite=x')).toBe(
      '/',
    );
    expect(rememberNativeInvitation).not.toHaveBeenCalled();
  });
  it('preserves existing scheme routes', async () => {
    expect(await redirectClassroomLink('iconicedu://classroom-fixture')).toBe(
      'iconicedu://classroom-fixture',
    );
  });
  it('redeems personal handoffs without putting them in navigation state', async () => {
    jest.mocked(publicApiPost).mockResolvedValue({ linkToken: 'synthetic-recovery' });
    expect(await redirectClassroomLink('/live/aaaa#handoff=synthetic')).toMatch(
      /^\/classroom\/aaaa\?entry=[\d-]+$/,
    );
    expect(publicApiPost).toHaveBeenCalledWith('/live-sessions/aaaa/link-info', {
      token: 'synthetic',
      handoff: true,
      redemptionKey: 'synthetic-redemption-key',
    });
    expect(rememberNativeInvitation).toHaveBeenCalledWith('aaaa', 'synthetic-recovery');
  });
  it('shows a recoverable error if secure persistence fails', async () => {
    jest.mocked(rememberNativeInvitation).mockRejectedValueOnce(new Error('locked'));
    expect(await redirectClassroomLink('/live/aaaa#invite=synthetic')).toBe(
      '/classroom-link-error',
    );
  });
});

it('reopens entry when the same classroom link is received again', async () => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  const first = await redirectClassroomLink('/live/aaaa');
  const second = await redirectClassroomLink('/live/aaaa');
  expect(first).not.toBe(second);
  expect(second).not.toContain('invite=');
});
