import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCallDetails } from './classroom-call-details';
const f = vi.hoisted(() => ({
  detail: vi.fn(),
  joinMissed: vi.fn(),
  messageTutor: vi.fn(),
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: f.push }) }));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}));
vi.mock('@iconicedu/web/lib/api/classroom-calls', () => ({
  createClassroomCallsApi: () => ({
    detail: f.detail,
    joinMissed: f.joinMissed,
    messageTutor: f.messageTutor,
  }),
}));
const missed = {
  id: 'call',
  sessionId: 'session',
  classTitle: 'Test class',
  callerName: 'Test tutor',
  status: 'expired',
  canJoin: true,
  messageAvailable: true,
};
describe('missed class call options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.detail.mockResolvedValue(missed);
    f.joinMissed.mockResolvedValue({ sessionId: 'session' });
    f.messageTutor.mockResolvedValue({ webPath: '/academy/dm/tutor' });
  });
  it('shows missed-call context and rechecks the class before joining', async () => {
    render(<ClassroomCallDetails callId="call" />);
    await act(async () => {});
    expect(screen.getByText('Missed call')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join classroom' }));
    await act(async () => {});
    expect(f.joinMissed).toHaveBeenCalledWith('call');
    expect(f.push).toHaveBeenCalledWith('/live/session');
  });
  it('allows messaging but disables joining outside class time', async () => {
    f.detail.mockResolvedValue({ ...missed, canJoin: false });
    render(<ClassroomCallDetails callId="call" />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Join classroom' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Message tutor' }));
    await act(async () => {});
    expect(f.messageTutor).toHaveBeenCalledWith('call');
    expect(f.push).toHaveBeenCalledWith('/academy/dm/tutor');
  });
});
