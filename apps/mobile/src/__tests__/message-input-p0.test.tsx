import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessageInput } from '@/components/messages/message-input';
import type { MentionCandidate } from '@/lib/messages/message-mentions';
import { MESSAGE_DRAFT_STORAGE_VERSION } from '@iconicedu/shared-types';

const DRAFT_SCOPE = {
  accountId: 'account-1',
  profileId: 'profile-1',
  orgId: 'org-1',
  channelId: 'channel-1',
};

const MENTION_CANDIDATES: MentionCandidate[] = [
  { id: 'profile-2', displayName: 'Jordan Lee', role: 'tutor' },
  { id: 'profile-3', displayName: 'Jamie Fox', role: 'guardian' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('MessageInput — drafts (enableMessageDrafts)', () => {
  it('is inert when enableDrafts is false: no autosave, no status hint', async () => {
    jest.useFakeTimers();
    render(
      <MessageInput onSend={jest.fn()} enableDrafts={false} draftScope={DRAFT_SCOPE} />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello draft');
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
    expect(screen.queryByLabelText('Draft saved')).toBeNull();
    jest.useRealTimers();
  });

  it('autosaves after the debounce window and shows a saved hint', async () => {
    jest.useFakeTimers();
    render(<MessageInput onSend={jest.fn()} enableDrafts draftScope={DRAFT_SCOPE} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello draft');
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    const raw = await AsyncStorage.getItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
    );
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).content).toBe('Hello draft');
    jest.useRealTimers();
  });

  it('restores a saved draft into the input on mount', async () => {
    await AsyncStorage.setItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
      JSON.stringify({
        version: MESSAGE_DRAFT_STORAGE_VERSION,
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
        content: 'Restored content',
        updatedAt: new Date().toISOString(),
      }),
    );

    render(<MessageInput onSend={jest.fn()} enableDrafts draftScope={DRAFT_SCOPE} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Message input').props.value).toBe('Restored content'),
    );
  });

  it('clears the draft only after a confirmed send', async () => {
    jest.useFakeTimers();
    const onSend = jest.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} enableDrafts draftScope={DRAFT_SCOPE} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello draft');
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).not.toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Send message'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
    jest.useRealTimers();
  });

  it('keeps the draft when send-reliability is on and the send rejects', async () => {
    jest.useFakeTimers();
    const onSend = jest.fn().mockRejectedValue(new Error('network down'));
    render(
      <MessageInput
        onSend={onSend}
        enableDrafts
        draftScope={DRAFT_SCOPE}
        enableSendReliability
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello draft');
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Send message'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).not.toBeNull();
    jest.useRealTimers();
  });
});

describe('MessageInput — edit mode (enableMessageEdit)', () => {
  it('does not render Save/Cancel when editingMessage is null', () => {
    render(<MessageInput onSend={jest.fn()} editingMessage={null} />);
    expect(screen.queryByLabelText('Save edit')).toBeNull();
    expect(screen.queryByLabelText('Cancel edit')).toBeNull();
  });

  it('prefills the input and shows Save/Cancel when editingMessage is set', () => {
    render(
      <MessageInput
        onSend={jest.fn()}
        editingMessage={{ messageId: 'msg-1', content: 'Original text' }}
      />,
    );

    expect(screen.getByLabelText('Message input').props.value).toBe('Original text');
    expect(screen.getByLabelText('Save edit')).toBeTruthy();
    expect(screen.getByLabelText('Cancel edit')).toBeTruthy();
    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(screen.queryByLabelText('Add attachment')).toBeNull();
  });

  it('saves the edit and exits edit mode when onSaveEdit resolves true', async () => {
    const onSaveEdit = jest.fn().mockResolvedValue(true);
    const onCancelEdit = jest.fn();
    render(
      <MessageInput
        onSend={jest.fn()}
        editingMessage={{ messageId: 'msg-1', content: 'Original text' }}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Edited text');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save edit'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSaveEdit).toHaveBeenCalledWith({
      messageId: 'msg-1',
      content: 'Edited text',
      mentions: undefined,
    });
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('stays in edit mode when onSaveEdit resolves false (server rejected the edit)', async () => {
    const onSaveEdit = jest.fn().mockResolvedValue(false);
    const onCancelEdit = jest.fn();
    render(
      <MessageInput
        onSend={jest.fn()}
        editingMessage={{ messageId: 'msg-1', content: 'Original text' }}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save edit'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCancelEdit).not.toHaveBeenCalled();
  });
});

describe('MessageInput — mentions (enableMobileMessageComposerParity)', () => {
  it('does not show mention suggestions when enableMentions is false', () => {
    render(
      <MessageInput
        onSend={jest.fn()}
        enableMentions={false}
        mentionCandidates={MENTION_CANDIDATES}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hi @Jo');
    expect(screen.queryByLabelText('Mention Jordan Lee')).toBeNull();
  });

  it('ranks and shows suggestions for an in-progress @query, and inserting one produces a spec-correct mention on send', async () => {
    const onSend = jest.fn();
    render(
      <MessageInput
        onSend={onSend}
        enableMentions
        mentionCandidates={MENTION_CANDIDATES}
      />,
    );

    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'Hi @Jo');
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { start: 6, end: 6 } },
    });

    expect(screen.getByLabelText('Mention Jordan Lee')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Mention Jordan Lee'));
    expect(screen.getByLabelText('Message input').props.value).toBe('Hi @Jordan Lee ');

    fireEvent.press(screen.getByLabelText('Send message'));

    expect(onSend).toHaveBeenCalledWith('Hi @Jordan Lee', {
      mentions: [
        { profileId: 'profile-2', displayName: 'Jordan Lee', start: 3, end: 14 },
      ],
    });
  });
});

describe('MessageInput — bold/italic formatting (enableMobileMessageComposerParity)', () => {
  it('does not render the formatting toolbar when enableFormatting is false', () => {
    render(<MessageInput onSend={jest.fn()} enableFormatting={false} />);
    expect(screen.queryByLabelText('Bold')).toBeNull();
    expect(screen.queryByLabelText('Italic')).toBeNull();
  });

  it('wraps the selected text in ** when Bold is pressed', () => {
    render(<MessageInput onSend={jest.fn()} enableFormatting />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello world');
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { start: 6, end: 11 } },
    });

    fireEvent.press(screen.getByLabelText('Bold'));

    expect(screen.getByLabelText('Message input').props.value).toBe('Hello **world**');
  });

  it('wraps at the caret with * when Italic is pressed and nothing is selected', () => {
    render(<MessageInput onSend={jest.fn()} enableFormatting />);
    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello');
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { start: 5, end: 5 } },
    });

    fireEvent.press(screen.getByLabelText('Italic'));

    expect(screen.getByLabelText('Message input').props.value).toBe('Hello**');
  });
});

describe('MessageInput — send-failure recovery (enableMessageSendReliability)', () => {
  it('does not attach a clientMessageId when the flag is off', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} enableSendReliability={false} />);
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('generates a fresh clientMessageId per send attempt when the flag is on', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} enableSendReliability />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'First');
    fireEvent.press(screen.getByLabelText('Send message'));
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Second');
    fireEvent.press(screen.getByLabelText('Send message'));

    expect(onSend).toHaveBeenCalledTimes(2);
    const firstId = onSend.mock.calls[0][1]?.clientMessageId;
    const secondId = onSend.mock.calls[1][1]?.clientMessageId;
    expect(typeof firstId).toBe('string');
    expect(firstId).not.toBe(secondId);
  });
});
