import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IncomingClassCall } from './incoming-class-call';
const f = vi.hoisted(() => ({
  incoming: vi.fn(),
  respond: vi.fn(),
  push: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  messageTutor: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: f.push }) }));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}));
vi.mock('@iconicedu/web/lib/api/classroom-calls', () => ({
  createClassroomCallsApi: () => ({
    incoming: f.incoming,
    respond: f.respond,
    messageTutor: f.messageTutor,
  }),
}));
describe('incoming class invitation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    vi.stubGlobal(
      'Audio',
      class {
        loop = false;
        play = f.play;
        pause = f.pause;
      },
    );
    f.play.mockResolvedValue(undefined);
    f.incoming.mockResolvedValue([
      {
        id: 'call',
        sessionId: 'session',
        callerName: 'Test teacher',
        classTitle: 'Test class',
        status: 'ringing',
        messageAvailable: true,
        expiresAt: new Date(Date.now() + 45_000).toISOString(),
      },
    ]);
    f.respond.mockResolvedValue({ sessionId: 'session' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('rings and opens normal class preview only after answering', async () => {
    render(<IncomingClassCall />);
    await act(async () => {});
    expect(screen.getByText('Test teacher')).toBeInTheDocument();
    expect(f.play).toHaveBeenCalled();
    expect(f.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await act(async () => {});
    expect(f.respond).toHaveBeenCalledWith('call', 'accepted');
    expect(f.push).toHaveBeenCalledWith('/live/session');
    expect(f.pause).toHaveBeenCalled();
  });
  it('declines without entering the meeting', async () => {
    render(<IncomingClassCall />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await act(async () => {});
    expect(f.respond).toHaveBeenCalledWith('call', 'declined');
    expect(f.push).not.toHaveBeenCalled();
  });
  it('stops the ringtone at expiry even while offline', async () => {
    render(<IncomingClassCall />);
    await act(async () => {});
    f.incoming.mockRejectedValue(new Error('offline'));
    await act(async () => {
      vi.advanceTimersByTime(46_000);
    });
    expect(screen.queryByText('Test teacher')).not.toBeInTheDocument();
    expect(f.pause).toHaveBeenCalled();
  });
  it('opens Message tutor without accepting the class call', async () => {
    f.messageTutor.mockResolvedValue({ webPath: '/academy/dm/tutor' });
    render(<IncomingClassCall />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Message tutor' }));
    await act(async () => {});
    expect(f.messageTutor).toHaveBeenCalledWith('call');
    expect(f.push).toHaveBeenCalledWith('/academy/dm/tutor');
    expect(f.respond).not.toHaveBeenCalledWith('call', 'accepted');
  });
});
