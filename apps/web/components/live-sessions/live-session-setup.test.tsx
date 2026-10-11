import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSessionSetup, type LiveSessionMeetingProps } from './live-session-setup';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), guestJoin: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@iconicedu/web/lib/live-sessions/public-api', () => ({
  guestJoinLiveSession: mocks.guestJoin,
}));
vi.mock('./zoom-meeting-renderer', () => ({ ZoomMeetingRenderer: () => null }));
const credentials = {
  token: 'synthetic-token',
  sessionName: 'test-class',
  displayName: 'Alex',
  expiresAt: null,
};
const Meeting = ({ displayName, initialMuted, onLeave }: LiveSessionMeetingProps) => (
  <div>
    <p>In meeting as {displayName}</p>
    <p>{initialMuted ? 'Muted' : 'Unmuted'}</p>
    <button onClick={onLeave}>Leave meeting</button>
  </div>
);

function setup(props: Partial<Parameters<typeof LiveSessionSetup>[0]> = {}) {
  return render(
    <StrictMode>
      <LiveSessionSetup
        sessionId="test-session"
        sessionTitle="Science class"
        MeetingRenderer={Meeting}
        {...props}
      />
    </StrictMode>,
  );
}

describe('live session setup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.guestJoin.mockResolvedValue(credentials);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    });
  });
  it('skips the name form for authenticated participants and performs one join in Strict Mode', async () => {
    setup({
      participantName: 'Alex',
      initialPasscode: 'demo',
      accessToken: 'synthetic-auth',
    });
    await screen.findByText('Check your camera and microphone before joining.');
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(mocks.guestJoin).toHaveBeenCalledExactlyOnceWith(
      'test-session',
      { displayName: 'Alex', passcode: 'demo' },
      'synthetic-auth',
    );
  });
  it('still asks anonymous visitors for their name', async () => {
    const user = userEvent.setup();
    setup({ initialPasscode: 'demo' });
    await user.type(await screen.findByLabelText('Your name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('Check your camera and microphone before joining.');
    expect(mocks.guestJoin).toHaveBeenCalledWith(
      'test-session',
      { displayName: 'Sam', passcode: 'demo' },
      undefined,
    );
  });
  it('requires only the passcode for a signed-in participant without a shared passcode', async () => {
    setup({ participantName: 'Alex' });
    expect(await screen.findByLabelText('Session passcode')).toBeVisible();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(mocks.guestJoin).not.toHaveBeenCalled();
  });
  it('shows an incorrect shared passcode and allows correction without an automatic retry loop', async () => {
    const user = userEvent.setup();
    mocks.guestJoin.mockResolvedValueOnce({ status: 403, message: 'Incorrect passcode' });
    setup({ participantName: 'Alex', initialPasscode: 'wrong' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect passcode');
    expect(mocks.guestJoin).toHaveBeenCalledOnce();
    const input = screen.getByLabelText('Session passcode');
    await user.clear(input);
    await user.type(input, 'correct');
    await user.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('Check your camera and microphone before joining.');
    expect(mocks.guestJoin).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['/academy/messages?channel=class-1', '/academy/messages?channel=class-1'],
    [undefined, '/'],
    ['//evil.invalid', '/'],
  ])('returns to %s after leaving and clears recovery', async (returnPath, expected) => {
    setup({ initialCredentials: credentials, returnPath });
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    expect(await screen.findByText('In meeting as Alex')).toBeVisible();
    expect(screen.getByText('Muted')).toBeVisible();
    expect(sessionStorage.getItem('iconicedu:live-session:test-session')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave meeting' }));
    expect(mocks.replace).toHaveBeenCalledWith(expected);
    expect(sessionStorage.getItem('iconicedu:live-session:test-session')).toBeNull();
  });
  it('restores a joined participant on refresh without another request or preview', async () => {
    const view = setup({ participantName: 'Alex', initialPasscode: 'demo' });
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('In meeting as Alex');
    view.unmount();
    mocks.guestJoin.mockClear();
    setup({ participantName: 'Alex', initialPasscode: 'demo' });
    await screen.findByText('In meeting as Alex');
    expect(mocks.guestJoin).not.toHaveBeenCalled();
  });
  it('does not restore a different signed-in participant', async () => {
    sessionStorage.setItem(
      'iconicedu:live-session:test-session',
      JSON.stringify({
        joinedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        muted: true,
        videoOff: true,
        payload: { credentials, passcode: 'demo', participantName: 'Someone else' },
      }),
    );
    setup({ participantName: 'Alex', initialPasscode: 'demo' });
    await waitFor(() => expect(mocks.guestJoin).toHaveBeenCalledOnce());
    expect(
      await screen.findByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
  });
  it.each([
    { credentials: { token: null }, passcode: 'demo', participantName: 'Alex' },
    { credentials, passcode: 123, participantName: 'Alex' },
    { credentials, passcode: 'demo' },
  ])('ignores malformed recovery credentials: %j', async (payload) => {
    sessionStorage.setItem(
      'iconicedu:live-session:test-session',
      JSON.stringify({
        joinedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        muted: true,
        videoOff: true,
        payload,
      }),
    );
    setup({ participantName: 'Alex', initialPasscode: 'demo' });
    await screen.findByText('Check your camera and microphone before joining.');
    expect(mocks.guestJoin).toHaveBeenCalledOnce();
  });
  it('does not restore expired credentials', async () => {
    sessionStorage.setItem(
      'iconicedu:live-session:test-session',
      JSON.stringify({
        joinedAt: 0,
        expiresAt: 1,
        muted: true,
        videoOff: true,
        payload: { credentials, passcode: 'demo', participantName: 'Alex' },
      }),
    );
    setup({ participantName: 'Alex', initialPasscode: 'demo' });
    await screen.findByText('Check your camera and microphone before joining.');
    expect(mocks.guestJoin).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('iconicedu:live-session:test-session')).toBeNull();
  });

  it('does not reuse credentials after signing in as another person with the same name', async () => {
    const first = setup({
      participantName: 'Alex',
      identityKey: 'first-user',
      initialPasscode: 'demo',
    });
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('In meeting as Alex');
    first.unmount();
    mocks.guestJoin.mockClear();
    setup({
      participantName: 'Alex',
      identityKey: 'second-user',
      initialPasscode: 'demo',
    });
    await screen.findByText('Check your camera and microphone before joining.');
    expect(mocks.guestJoin).toHaveBeenCalledOnce();
  });
  it('joins a single linked student directly from preview and restores that student on refresh', async () => {
    const students = [{ profileId: 'child-one', displayName: 'Alice' }];
    mocks.guestJoin.mockResolvedValue({
      ...credentials,
      displayName: 'Alice',
      studentProfileId: 'child-one',
    });
    const props = {
      participantName: 'Alice',
      students,
      initialPasscode: 'demo',
      identityKey: 'parent-user',
    };
    const view = setup(props);
    await screen.findByText('Alice');
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(mocks.guestJoin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('In meeting as Alice');
    expect(mocks.guestJoin).toHaveBeenCalledExactlyOnceWith(
      'test-session',
      { displayName: 'Alice', passcode: 'demo', studentProfileId: 'child-one' },
      undefined,
    );
    view.unmount();
    mocks.guestJoin.mockClear();
    setup(props);
    await screen.findByText('In meeting as Alice');
    expect(mocks.guestJoin).not.toHaveBeenCalled();
  });
  it('requires an explicit student choice for siblings before issuing credentials', async () => {
    mocks.guestJoin.mockResolvedValue({
      ...credentials,
      displayName: 'Ben',
      studentProfileId: 'child-two',
    });
    setup({
      participantName: 'Student',
      initialPasscode: 'demo',
      students: [
        { profileId: 'child-one', displayName: 'Alice' },
        { profileId: 'child-two', displayName: 'Ben' },
      ],
    });
    const join = await screen.findByRole('button', { name: 'Join session' });
    expect(join).toBeDisabled();
    expect(mocks.guestJoin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Ben' }));
    expect(join).toBeEnabled();
    fireEvent.click(join);
    await screen.findByText('In meeting as Ben');
    expect(mocks.guestJoin).toHaveBeenCalledWith(
      'test-session',
      { displayName: 'Ben', passcode: 'demo', studentProfileId: 'child-two' },
      undefined,
    );
  });
  it('keeps preview open and allows correcting a rejected parent join passcode', async () => {
    mocks.guestJoin.mockResolvedValueOnce({ status: 403, message: 'Incorrect passcode' });
    mocks.guestJoin.mockResolvedValueOnce({
      ...credentials,
      displayName: 'Alice',
      studentProfileId: 'child-one',
    });
    setup({
      initialPasscode: 'wrong',
      students: [{ profileId: 'child-one', displayName: 'Alice' }],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Join session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect passcode');
    fireEvent.change(screen.getByLabelText('Session passcode'), {
      target: { value: 'correct' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('In meeting as Alice');
    expect(mocks.guestJoin).toHaveBeenLastCalledWith(
      'test-session',
      { displayName: 'Alice', passcode: 'correct', studentProfileId: 'child-one' },
      undefined,
    );
  });
  it('blocks joining when no linked student is enrolled', async () => {
    setup({ initialPasscode: 'demo', students: [] });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'None of your linked students',
    );
    expect(screen.getByRole('button', { name: 'Join session' })).toBeDisabled();
    expect(mocks.guestJoin).not.toHaveBeenCalled();
  });
  it('does not restore an account-holder identity or an ineligible child for a parent', async () => {
    const props = {
      participantName: 'Student',
      identityKey: 'parent-user',
      initialPasscode: 'demo',
    };
    const first = setup(props);
    await screen.findByText('Check your camera and microphone before joining.');
    fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
    await screen.findByText('In meeting as Alex');
    first.unmount();
    mocks.guestJoin.mockClear();
    setup({
      ...props,
      students: [
        { profileId: 'child-one', displayName: 'Alice' },
        { profileId: 'child-two', displayName: 'Ben' },
      ],
    });
    expect(await screen.findByRole('radio', { name: 'Alice' })).not.toBeChecked();
    expect(screen.queryByText('In meeting as Alex')).not.toBeInTheDocument();
    expect(mocks.guestJoin).not.toHaveBeenCalled();
  });
});
