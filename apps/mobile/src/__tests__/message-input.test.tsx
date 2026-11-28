import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageInput } from '@/components/messages/message-input';

describe('MessageInput', () => {
  it.each(['owner', 'admin', 'staff', 'guardian', 'child', 'educator'])(
    '%s targets one parent rather than all parents, then resets to everyone',
    async (role) => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      render(
        <MessageInput
          onSend={onSend}
          profileId={role}
          audienceParticipants={[
            { id: role, name: 'Sender', role: 'staff' },
            { id: 'parent-A', name: 'Parent Alpha', role: 'guardian' },
            { id: 'parent-B', name: 'Parent Beta', role: 'guardian' },
          ]}
        />,
      );
      expect(screen.queryByLabelText('Message audience Sender')).toBeNull();
      fireEvent.press(screen.getByLabelText('Message audience Parent Alpha'));
      fireEvent.changeText(screen.getByLabelText('Message input'), 'Private');
      fireEvent.press(screen.getByLabelText('Send message'));
      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith('Private', {
          audienceProfileIds: ['parent-A'],
        }),
      );
      await waitFor(() =>
        expect(
          screen.getByLabelText('Message audience Everyone').props.accessibilityState
            .selected,
        ).toBe(true),
      );
      fireEvent.changeText(screen.getByLabelText('Message input'), 'Public');
      fireEvent.press(screen.getByLabelText('Send message'));
      await waitFor(() => expect(onSend).toHaveBeenLastCalledWith('Public'));
    },
  );
  it('retains the private audience after a failed send instead of widening the next send', async () => {
    const onSend = jest
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        profileId="sender"
        audienceParticipants={[
          { id: 'sender', name: 'Sender', role: 'staff' },
          { id: 'parent-A', name: 'Parent Alpha', role: 'guardian' },
        ]}
      />,
    );
    fireEvent.press(screen.getByLabelText('Message audience Parent Alpha'));
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Private failed');
    fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByLabelText('Message audience Parent Alpha').props.accessibilityState
          .selected,
      ).toBe(true),
    );
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Private retry');
    fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() =>
      expect(onSend).toHaveBeenLastCalledWith('Private retry', {
        audienceProfileIds: ['parent-A'],
      }),
    );
  });
  it('includes a selected channel audience in send metadata', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        profileId="staff-1"
        audienceParticipants={[
          { id: 'staff-1', name: 'Sam Staff', role: 'staff' },
          { id: 'parent-1', name: 'Alex Parent', role: 'guardian' },
          { id: 'tutor-1', name: 'Taylor Tutor', role: 'educator' },
        ]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Message audience Parents'));
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Welcome');
    fireEvent.press(screen.getByLabelText('Send message'));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('Welcome', {
        audienceProfileIds: ['parent-1'],
      }),
    );
  });

  describe('audience safeguarding', () => {
    const channel = [
      { id: 'staff-1', name: 'Sam Staff', role: 'staff' },
      { id: 'tutor-1', name: 'Taylor Tutor', role: 'educator' },
      { id: 'parent-1', name: 'Alex Parent', role: 'guardian' },
      { id: 'parent-2', name: 'Blair Parent', role: 'guardian' },
      { id: 'student-1', name: 'Casey Student', role: 'child' },
    ];
    const renderAs = (profileId: string) =>
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId={profileId}
          audienceParticipants={channel}
        />,
      );

    it.each(['student-1', 'unknown-profile'])('hides the picker for %s', (profileId) => {
      renderAs(profileId);
      expect(screen.queryByTestId('message-audience-picker')).toBeNull();
    });

    it('lets parents address only staff and tutors', () => {
      renderAs('parent-1');
      expect(screen.getByLabelText('Message audience Sam Staff')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Taylor Tutor')).toBeTruthy();
      expect(screen.queryByLabelText('Message audience Blair Parent')).toBeNull();
      expect(screen.queryByLabelText('Message audience Casey Student')).toBeNull();
      expect(screen.queryByLabelText('Message audience Parents')).toBeNull();
    });

    it('lets tutors address students and says the parent is included', () => {
      renderAs('tutor-1');
      expect(screen.queryByTestId('message-audience-guardian-hint')).toBeNull();
      fireEvent.press(screen.getByLabelText('Message audience Casey Student'));
      expect(screen.getByTestId('message-audience-guardian-hint')).toBeTruthy();
    });

    it('lets staff address everyone', () => {
      renderAs('staff-1');
      for (const name of [
        'Taylor Tutor',
        'Alex Parent',
        'Blair Parent',
        'Casey Student',
      ]) {
        expect(screen.getByLabelText(`Message audience ${name}`)).toBeTruthy();
      }
    });
  });

  it('renders input field', () => {
    render(<MessageInput onSend={jest.fn()} />);
    expect(screen.getByLabelText('Message input')).toBeTruthy();
  });

  it('renders send button', () => {
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    expect(screen.getByLabelText('Send message')).toBeTruthy();
  });

  it('calls onSend with text when send button is pressed', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent.press(screen.getByLabelText('Send message'));

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after sending', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    let input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello');
    fireEvent.press(screen.getByLabelText('Send message'));

    input = screen.getByLabelText('Message input');
    expect(input.props.value).toBe('');
  });

  it('clears the multiline draft state after sending', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    let input = screen.getByLabelText('Message input');

    fireEvent.changeText(input, 'Hello\nworld\nagain');
    fireEvent(input, 'onContentSizeChange', {
      nativeEvent: { contentSize: { height: 72 } },
    });

    fireEvent.press(screen.getByLabelText('Send message'));

    input = screen.getByLabelText('Message input');
    expect(input.props.value).toBe('');
    expect(screen.queryByLabelText('Send message')).toBeNull();
  });

  it('does not send empty messages', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), '   ');
    expect(screen.queryByLabelText('Send message')).toBeNull();

    expect(onSend).not.toHaveBeenCalled();
  });

  it('renders custom placeholder', () => {
    render(<MessageInput onSend={jest.fn()} placeholder="Write something..." />);
    expect(screen.getByPlaceholderText('Write something...')).toBeTruthy();
  });

  it('truncates long placeholder text after 25 characters', () => {
    render(
      <MessageInput
        onSend={jest.fn()}
        placeholder="This placeholder should truncate after twenty five characters"
      />,
    );

    expect(screen.getByPlaceholderText('This placeholder should t...')).toBeTruthy();
  });
});

// ─── Scheduled send (issue #264 P2) ────────────────────────────────────────

describe('MessageInput — scheduled send', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('does not offer scheduling on long-press when enableScheduledSend is false (flag-off inertness)', () => {
    const onSend = jest.fn();
    const onScheduleSend = jest.fn();
    render(
      <MessageInput
        onSend={onSend}
        onScheduleSend={onScheduleSend}
        enableScheduledSend={false}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent(screen.getByLabelText('Send message'), 'longPress');

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does not offer scheduling on long-press when onScheduleSend is not provided (flag-off inertness)', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} enableScheduledSend />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent(screen.getByLabelText('Send message'), 'longPress');

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('long-pressing send offers "Send now" which sends immediately (branching)', () => {
    const onSend = jest.fn();
    const onScheduleSend = jest.fn();
    render(
      <MessageInput
        onSend={onSend}
        onScheduleSend={onScheduleSend}
        enableScheduledSend
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent(screen.getByLabelText('Send message'), 'longPress');

    expect(alertSpy).toHaveBeenCalledWith(
      'Send message',
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Schedule send' }),
        expect.objectContaining({ text: 'Send now' }),
      ]),
    );

    // Simulate the user tapping "Send now" in the alert.
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    buttons.find((b) => b.text === 'Send now')?.onPress?.();

    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(onScheduleSend).not.toHaveBeenCalled();
  });

  it('long-pressing send offers "Schedule send" which opens the date/time picker and, on confirm, calls onScheduleSend with a timezone-aware sendAt (branching)', async () => {
    const onSend = jest.fn();
    const onScheduleSend = jest.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        onScheduleSend={onScheduleSend}
        enableScheduledSend
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText('Message input'),
      'Remember to bring gear',
    );
    fireEvent(screen.getByLabelText('Send message'), 'longPress');

    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    buttons.find((b) => b.text === 'Schedule send')?.onPress?.();

    // The picker (iOS path renders a Confirm button; Android drives a native
    // dialog directly — this test environment resolves as iOS by default).
    const confirmButton = await screen.findByLabelText('Confirm scheduled time');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(onScheduleSend).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Remember to bring gear' }),
      );
    });
    const call = onScheduleSend.mock.calls[0][0];
    expect(typeof call.sendAt).toBe('string');
    expect(() => new Date(call.sendAt).toISOString()).not.toThrow();
    // timezone is either a resolved IANA string or null — never undefined
    expect(call.timezone === null || typeof call.timezone === 'string').toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears the composer after a successful schedule', async () => {
    const onScheduleSend = jest.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={jest.fn()}
        onScheduleSend={onScheduleSend}
        enableScheduledSend
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Later message');
    fireEvent(screen.getByLabelText('Send message'), 'longPress');
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    buttons.find((b) => b.text === 'Schedule send')?.onPress?.();

    const confirmButton = await screen.findByLabelText('Confirm scheduled time');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(onScheduleSend).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Message input').props.value).toBe('');
    });
  });

  it('surfaces a scheduling error via Alert instead of crashing, and keeps the draft text', async () => {
    const onScheduleSend = jest.fn().mockRejectedValue(new Error('Network error'));
    render(
      <MessageInput
        onSend={jest.fn()}
        onScheduleSend={onScheduleSend}
        enableScheduledSend
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Later message');
    fireEvent(screen.getByLabelText('Send message'), 'longPress');
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    buttons.find((b) => b.text === 'Schedule send')?.onPress?.();

    const confirmButton = await screen.findByLabelText('Confirm scheduled time');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Unable to schedule message',
        'Network error',
      );
    });
    expect(screen.getByLabelText('Message input').props.value).toBe('Later message');
  });
});
