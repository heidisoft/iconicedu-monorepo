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
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.queryByLabelText('Message audience Sender')).toBeNull();
      fireEvent.press(screen.getByLabelText('Message audience Parent Alpha'));
      fireEvent.changeText(screen.getByLabelText('Message input'), 'Private');
      fireEvent.press(screen.getByLabelText('Send message'));
      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith('Private', {
          audienceProfileIds: ['parent-A'],
        }),
      );
      // A confirmed send resets the audience and folds the picker back to one chip.
      await waitFor(() =>
        expect(
          screen.getByLabelText('Audience: Everyone. Show audience options'),
        ).toBeTruthy(),
      );
      expect(screen.queryByLabelText('Message audience Parent Alpha')).toBeNull();
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
    fireEvent.press(screen.getByTestId('message-audience-toggle'));
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

    fireEvent.press(screen.getByTestId('message-audience-toggle'));
    fireEvent.press(screen.getByLabelText('Message audience Alex Parent'));
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

    it('shows the picker to a staff observer who is not in the member list', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="observer-1"
          currentProfileKind="staff"
          audienceParticipants={channel}
        />,
      );
      expect(screen.getByTestId('message-audience-picker')).toBeTruthy();
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.getByLabelText('Message audience Casey Student')).toBeTruthy();
    });

    it("uses the sender's own kind over the member list", () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          currentProfileKind="child"
          audienceParticipants={channel}
        />,
      );
      expect(screen.queryByTestId('message-audience-picker')).toBeNull();
    });

    it.each(['student-1', 'unknown-profile'])('hides the picker for %s', (profileId) => {
      renderAs(profileId);
      expect(screen.queryByTestId('message-audience-picker')).toBeNull();
    });

    it('lets parents address only staff and tutors', () => {
      renderAs('parent-1');
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.queryByLabelText('Message audience Sam Staff')).toBeNull();
      expect(screen.getByLabelText('Message audience Staff')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Taylor Tutor')).toBeTruthy();
      expect(screen.queryByLabelText('Message audience Blair Parent')).toBeNull();
      expect(screen.queryByLabelText('Message audience Casey Student')).toBeNull();
      expect(screen.queryByLabelText('Message audience Parents')).toBeNull();
    });

    it('lets tutors address students and says the parent is included', () => {
      renderAs('tutor-1');
      expect(screen.queryByTestId('message-audience-guardian-hint')).toBeNull();
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Casey Student'));
      expect(screen.getByTestId('message-audience-guardian-hint')).toBeTruthy();
    });

    it('lets staff address everyone', () => {
      renderAs('staff-1');
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
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

  describe('audience picker parity with web', () => {
    const channel = [
      { id: 'staff-1', name: 'Sam Staff', role: 'staff' },
      { id: 'parent-1', name: 'Alex Parent', role: 'guardian' },
      { id: 'parent-2', name: 'Blair Parent', role: 'guardian' },
      { id: 'tutor-1', name: 'Taylor Tutor', role: 'educator' },
    ];

    it('selects several specific people and sends to all of them', async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      render(
        <MessageInput
          onSend={onSend}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Alex Parent'));
      fireEvent.press(screen.getByLabelText('Message audience Taylor Tutor'));
      expect(
        screen.getByLabelText('Message audience Alex Parent').props.accessibilityState
          .checked,
      ).toBe(true);
      expect(screen.getByTestId('message-audience-summary').props.children).toBe(
        'Visible only to Alex Parent, Taylor Tutor and you',
      );

      fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello both');
      fireEvent.press(screen.getByLabelText('Send message'));
      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith('Hello both', {
          audienceProfileIds: ['parent-1', 'tutor-1'],
        }),
      );
    });

    it('toggles a person off again', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Alex Parent'));
      fireEvent.press(screen.getByLabelText('Message audience Alex Parent'));
      expect(screen.queryByTestId('message-audience-summary')).toBeNull();
      expect(
        screen.getByLabelText('Message audience Everyone').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    it('starts collapsed to the current audience and reveals the options on tap', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      const toggle = screen.getByTestId('message-audience-toggle');
      expect(toggle.props.accessibilityLabel).toBe(
        'Audience: Everyone. Show audience options',
      );
      expect(screen.queryByLabelText('Message audience Parents')).toBeNull();
      expect(screen.queryByLabelText('Message audience Alex Parent')).toBeNull();

      fireEvent.press(toggle);
      expect(screen.queryByTestId('message-audience-toggle')).toBeNull();
      expect(screen.getByLabelText('Message audience Everyone')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Parents')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Alex Parent')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Hide audience options'));
      expect(screen.getByTestId('message-audience-toggle')).toBeTruthy();
      expect(screen.queryByLabelText('Message audience Parents')).toBeNull();
    });

    it('folds back after picking a group and shows it on the chip', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Parents'));
      expect(
        screen.getByLabelText('Audience: Parents. Show audience options'),
      ).toBeTruthy();
      expect(screen.queryByLabelText('Message audience Alex Parent')).toBeNull();
    });

    it('stays open while picking people and summarises them when folded', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Alex Parent'));
      fireEvent.press(screen.getByLabelText('Message audience Taylor Tutor'));
      expect(screen.getByLabelText('Message audience Blair Parent')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Hide audience options'));
      expect(
        screen.getByLabelText('Audience: Alex Parent +1. Show audience options'),
      ).toBeTruthy();
      expect(screen.getByTestId('message-audience-summary').props.children).toBe(
        'Visible only to Alex Parent, Taylor Tutor and you',
      );
    });

    it('offers staff as one Staff option, never by name, and sends to all of them', async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      render(
        <MessageInput
          onSend={onSend}
          profileId="parent-1"
          audienceParticipants={[
            ...channel,
            { id: 'owner-1', name: 'Olive Owner', role: 'staff' },
          ]}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.queryByLabelText('Message audience Sam Staff')).toBeNull();
      expect(screen.queryByLabelText('Message audience Olive Owner')).toBeNull();
      fireEvent.press(screen.getByLabelText('Message audience Staff'));
      expect(screen.getByTestId('message-audience-summary').props.children).toBe(
        'Visible only to staff and you',
      );
      fireEvent.press(screen.getByLabelText('Hide audience options'));
      expect(
        screen.getByLabelText('Audience: Staff. Show audience options'),
      ).toBeTruthy();

      fireEvent.changeText(screen.getByLabelText('Message input'), 'Heads up');
      fireEvent.press(screen.getByLabelText('Send message'));
      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith('Heads up', {
          audienceProfileIds: ['staff-1', 'owner-1'],
        }),
      );
    });

    it('combines Staff with a named tutor and toggles Staff off again', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="parent-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      fireEvent.press(screen.getByLabelText('Message audience Staff'));
      fireEvent.press(screen.getByLabelText('Message audience Taylor Tutor'));
      expect(screen.getByTestId('message-audience-summary').props.children).toBe(
        'Visible only to staff, Taylor Tutor and you',
      );
      fireEvent.press(screen.getByLabelText('Message audience Staff'));
      expect(screen.getByTestId('message-audience-summary').props.children).toBe(
        'Visible only to Taylor Tutor and you',
      );
    });

    it('has no Staff option when the sender is the only staff member', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.queryByLabelText('Message audience Staff')).toBeNull();
      // One tutor: a singular "Tutor" group as well as their name.
      expect(screen.getByLabelText('Message audience Tutor')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Taylor Tutor')).toBeTruthy();
    });

    it('offers parent, tutor and student groups alongside single people', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={[
            ...channel,
            { id: 'student-1', name: 'Casey Student', role: 'child' },
          ]}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.getByLabelText('Message audience Parents')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Tutor')).toBeTruthy();
      expect(screen.getByLabelText('Message audience Student')).toBeTruthy();

      // Picking one person shows their name, even when they are the whole group.
      fireEvent.press(screen.getByLabelText('Message audience Taylor Tutor'));
      fireEvent.press(screen.getByLabelText('Hide audience options'));
      expect(
        screen.getByLabelText('Audience: Taylor Tutor. Show audience options'),
      ).toBeTruthy();
    });

    it('labels each person with their role', () => {
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
        />,
      );
      fireEvent.press(screen.getByTestId('message-audience-toggle'));
      expect(screen.getAllByText(' · Parent')).toHaveLength(2);
      expect(screen.getByText(' · Tutor')).toBeTruthy();
    });

    it('names the inherited audience on a private thread reply', () => {
      const replyTo = {
        ids: { id: 'private-1', orgId: 'org-1' },
        core: {
          type: 'text',
          sender: { ids: { id: 'tutor-1' }, profile: { displayName: 'Taylor Tutor' } },
          createdAt: '2026-01-01T00:00:00Z',
          visibility: { type: 'specific-users', userIds: ['tutor-1', 'staff-1'] },
        },
        social: { reactions: [] },
        content: { text: 'Private' },
      } as never;
      render(
        <MessageInput
          onSend={jest.fn()}
          profileId="staff-1"
          audienceParticipants={channel}
          replyTo={replyTo}
        />,
      );
      expect(screen.getByTestId('reply-private-audience').props.children).toBe(
        '· Private · Taylor Tutor, You',
      );
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
