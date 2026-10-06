import { describe, expect, it, vi, beforeEach } from 'vitest';
import PublicLiveSessionPage from './page';

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  getSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: mocks.getSession } }),
}));
vi.mock('@iconicedu/web/lib/live-sessions/public-info', () => ({
  getPublicLiveSessionInfo: mocks.info,
}));
vi.mock('@iconicedu/web/components/live-sessions/live-session-setup', () => ({
  LiveSessionSetup: () => null,
}));
const params = Promise.resolve({ sessionId: 'demo' });

describe('public live session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'synthetic-auth' } },
    });
  });
  it('passes the verified participant name and source to setup', async () => {
    mocks.info.mockResolvedValue({
      exists: true,
      isActive: true,
      isHost: false,
      sessionTitle: 'Science',
      participant: { displayName: 'Alex' },
    });
    const page = await PublicLiveSessionPage({
      params,
      searchParams: Promise.resolve({ passcode: 'demo', returnTo: '/academy/messages' }),
    });
    expect(page.props).toMatchObject({
      participantName: 'Alex',
      returnPath: '/academy/messages',
      initialPasscode: 'demo',
      accessToken: 'synthetic-auth',
      initialCredentials: null,
    });
    expect(mocks.info).toHaveBeenCalledWith('demo', 'synthetic-auth');
  });
  it('uses host credentials without a name or guest join form', async () => {
    const hostJoin = {
      displayName: 'Teacher',
      token: 'synthetic-token',
      sessionName: 'science',
      expiresAt: null,
      passcode: 'demo',
    };
    mocks.info.mockResolvedValue({
      exists: true,
      isActive: true,
      isHost: true,
      sessionTitle: 'Science',
      hostJoin,
    });
    const page = await PublicLiveSessionPage({
      params,
      searchParams: Promise.resolve({}),
    });
    expect(page.props).toMatchObject({
      initialCredentials: hostJoin,
      participantName: 'Teacher',
      returnPath: '/',
    });
  });
  it('shows the ended state rather than mounting setup', async () => {
    mocks.info.mockResolvedValue({
      exists: true,
      isActive: false,
      sessionTitle: 'Science',
    });
    const page = await PublicLiveSessionPage({
      params,
      searchParams: Promise.resolve({}),
    });
    expect(page.props.children[0].props.children).toBe('Session has ended');
  });
  it('404s sessions that do not exist', async () => {
    mocks.info.mockResolvedValue({ exists: false });
    await expect(
      PublicLiveSessionPage({ params, searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('not found');
  });
});
