import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ post: vi.fn(), setup: vi.fn() }));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createPublicApiClient: () => ({ post: mocks.post }),
  ApiHttpError: class extends Error {
    status = 403;
  },
}));
vi.mock('./live-session-setup', () => ({
  LiveSessionSetup: (props: unknown) => {
    mocks.setup(props);
    return <div>Meeting setup</div>;
  },
}));
vi.mock('./zoom-video/zoom-session-loading-screen', () => ({
  ZoomSessionLoadingScreen: () => <div>Loading</div>,
}));
import { LiveSessionLinkEntry } from './live-session-link-entry';
describe('meeting link admission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/live/aaaa-bbbb-cccc');
  });
  it('consumes a handoff once under Strict Mode and removes it before loading the meeting', async () => {
    window.history.replaceState(
      null,
      '',
      '/live/aaaa-bbbb-cccc#handoff=' + 'a'.repeat(32),
    );
    mocks.post.mockResolvedValue({
      linkToken: 'b'.repeat(32),
      info: {
        exists: true,
        isActive: true,
        isHost: false,
        passcodeRequired: false,
        participant: { displayName: 'Verified student' },
      },
    });
    render(
      <StrictMode>
        <LiveSessionLinkEntry sessionId="session" sessionTitle="Class" />
      </StrictMode>,
    );
    await screen.findByText('Meeting setup');
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('');
    expect(mocks.setup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        passcodeRequired: false,
        participantName: 'Verified student',
        linkToken: 'b'.repeat(32),
        accessToken: null,
      }),
    );
  });
  it('restores verified mobile identity after remount without a URL token', async () => {
    window.history.replaceState(
      null,
      '',
      '/live/aaaa-bbbb-cccc#handoff=' + 'a'.repeat(32),
    );
    mocks.post.mockResolvedValue({
      linkToken: 'b'.repeat(32),
      info: {
        exists: true,
        isActive: true,
        isHost: false,
        passcodeRequired: false,
        participant: { displayName: 'Verified student' },
      },
    });
    const first = render(
      <LiveSessionLinkEntry sessionId="session" sessionTitle="Class" />,
    );
    await screen.findByText('Meeting setup');
    const recovery = sessionStorage.getItem('iconicedu:meeting-link:session');
    first.unmount();
    mocks.post.mockClear();
    render(<LiveSessionLinkEntry sessionId="session" sessionTitle="Class" />);
    await screen.findByText('Meeting setup');
    expect(mocks.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'b'.repeat(32), handoff: false }),
    );
    expect(sessionStorage.getItem('iconicedu:meeting-link:session')).toBe(recovery);
    expect(mocks.setup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        participantName: 'Verified student',
        accessToken: null,
        passcodeRequired: false,
      }),
    );
  });
  it('shows an expired link alert instead of silently entering as an anonymous user', async () => {
    window.history.replaceState(
      null,
      '',
      '/live/aaaa-bbbb-cccc#invite=' + 'a'.repeat(32),
    );
    mocks.post.mockRejectedValue(
      new (await import('@iconicedu/web/lib/api/http-client')).ApiHttpError(
        403,
        'expired',
      ),
    );
    render(<LiveSessionLinkEntry sessionId="session" sessionTitle="Class" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('expired'));
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it('keeps the ordinary join flow for plain short links', async () => {
    render(<LiveSessionLinkEntry sessionId="session" sessionTitle="Class" />);
    await screen.findByText('Meeting setup');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
