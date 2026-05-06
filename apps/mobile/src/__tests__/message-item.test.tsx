import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MessageItem } from '@/components/messages/message-item';
import type { MessageVM } from '@iconicedu/shared-types';
import { lightColors as LIGHT } from '@/lib/theme';

const mockOpenBrowserAsync = jest.fn();
const mockFetchThreadMessages = jest.fn();
const mockMarkThreadReadState = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
    setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
  }),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  WebBrowserPresentationStyle: {
    PAGE_SHEET: 'pageSheet',
  },
}));

jest.mock('@/lib/api/queries', () => ({
  fetchThreadMessages: (...args: unknown[]) => mockFetchThreadMessages(...args),
  markThreadReadState: (...args: unknown[]) => mockMarkThreadReadState(...args),
  queryKeys: {
    messages: (channelId: string, profileId = '') => ['messages', channelId, profileId],
  },
}));

jest.mock('@/lib/messages/apply-optimistic-channel-read-state', () => ({
  applyOptimisticThreadReadState: jest.fn(),
}));

jest.mock('@/components/messages/chat-pdf-viewer', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    ChatPdfViewer: ({
      visible,
      filename,
    }: {
      visible: boolean;
      filename?: string | null;
    }) => (visible ? <Text>{`PDF viewer:${filename ?? 'unknown'}`}</Text> : null),
  };
});

jest.mock('@/components/profile/role-name-indicator', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    RoleNameIndicator: ({ name, role }: { name: string; role?: string | null }) => (
      <View>
        <Text>{name}</Text>
        {role === 'staff' ? <View testID="staff-name-indicator" /> : null}
      </View>
    ),
  };
});

const sender = {
  kind: 'educator',
  ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
  profile: {
    displayName: 'John Doe',
    avatar: {
      source: 'seed' as const,
      seed: 'john',
      url: null,
      updatedAt: '2025-01-01T00:00:00Z',
    },
  },
  prefs: {},
  meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
} as unknown as MessageVM['core']['sender'];

const baseMessage: MessageVM = {
  ids: { id: 'msg-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender,
    createdAt: '2025-01-15T10:30:00Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  state: {},
  content: { text: 'Hello world' },
} as unknown as MessageVM;

const staffMessage: MessageVM = {
  ...baseMessage,
  core: {
    ...baseMessage.core,
    sender: {
      ...sender,
      kind: 'staff',
      profile: {
        ...sender.profile,
        displayName: 'Staff Member',
      },
    } as MessageVM['core']['sender'],
  },
} as unknown as MessageVM;

const threadedUnreadMessage: MessageVM = {
  ...baseMessage,
  social: {
    reactions: [],
    thread: {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: {
        messageId: 'msg-1',
      },
      stats: {
        messageCount: 3,
        lastReplyAt: '2025-01-15T11:00:00Z',
      },
      participants: [sender],
      readState: {
        threadId: 'thread-1',
        unreadCount: 2,
      },
    },
  },
} as unknown as MessageVM;

const senderOnlyMessage: MessageVM = {
  ...baseMessage,
  core: {
    ...baseMessage.core,
    visibility: { type: 'sender-only' },
  },
} as unknown as MessageVM;

const specificUsersMessage: MessageVM = {
  ...baseMessage,
  core: {
    ...baseMessage.core,
    visibility: { type: 'specific-users', userIds: ['user-1', 'user-2'] },
  },
} as unknown as MessageVM;

const colors = LIGHT;

const pdfFileMessage: MessageVM = {
  ...baseMessage,
  core: {
    ...baseMessage.core,
    type: 'file',
  },
  attachment: {
    type: 'file',
    name: 'Worksheet.pdf',
    url: 'https://example.com/worksheet.pdf',
    mimeType: 'application/pdf',
    size: 120_000,
  },
} as unknown as MessageVM;

describe('MessageItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchThreadMessages.mockResolvedValue([
      {
        ...baseMessage,
        ids: { id: 'reply-1', orgId: 'org-1' },
        core: {
          ...baseMessage.core,
          createdAt: '2025-01-15T11:00:00Z',
        },
      } as MessageVM,
    ]);
    mockMarkThreadReadState.mockResolvedValue(0);
  });

  it('renders text message content', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} isGroupStart colors={colors} />,
    );
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('gives long text messages a definite bubble width so they wrap on mobile', () => {
    const longMessage = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'msg-long' },
      content: {
        text: 'Andrea is doing well getting started. She listens carefully and keeps building confidence through the lesson.',
      },
    } as unknown as MessageVM;

    render(
      <MessageItem message={longMessage} isOwn={false} isGroupStart colors={colors} />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('message-bubble').props.style)).toEqual(
      expect.objectContaining({ maxWidth: '78%', borderRadius: 18 }),
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('message-text-content').props.style),
    ).toEqual(expect.objectContaining({ flexWrap: 'wrap', fontSize: 17 }));
  });

  it('renders sender name when isGroupStart is true', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} isGroupStart colors={colors} />,
    );
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('renders the staff indicator next to staff sender names', () => {
    render(
      <MessageItem message={staffMessage} isOwn={false} isGroupStart colors={colors} />,
    );

    expect(screen.getByText('Staff Member')).toBeTruthy();
    expect(screen.getAllByTestId('staff-name-indicator').length).toBeGreaterThan(0);
  });

  it('hides sender name when isGroupStart is false', () => {
    render(
      <MessageItem
        message={baseMessage}
        isOwn={false}
        isGroupStart={false}
        colors={colors}
      />,
    );
    expect(screen.queryByText('John Doe')).toBeNull();
  });

  it('renders own message without bubble style', () => {
    render(<MessageItem message={baseMessage} isOwn isGroupStart colors={colors} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders audio message waveform', () => {
    const audioMsg = {
      ...baseMessage,
      core: { ...baseMessage.core, type: 'audio-recording' },
      audio: { durationSeconds: 65, waveform: [0.5, 0.8, 0.3] },
    } as unknown as MessageVM;
    render(<MessageItem message={audioMsg} isOwn={false} isGroupStart colors={colors} />);
    // Duration should show 1:05
    expect(screen.getByText('1:05')).toBeTruthy();
  });

  it('renders unread thread indicators when a thread has unread replies', () => {
    render(
      <MessageItem
        message={threadedUnreadMessage}
        isOwn={false}
        isGroupStart
        colors={colors}
      />,
    );

    expect(screen.getByTestId('thread-unread-new-badge')).toBeTruthy();
    expect(screen.getByTestId('thread-unread-count-badge')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('marks a thread as read using the screen channel id fallback when thread read state omits channelId', async () => {
    render(
      <MessageItem
        message={threadedUnreadMessage}
        channelId="channel-1"
        isOwn={false}
        isGroupStart
        colors={colors}
        currentProfileId="user-1"
        currentAccountId="acc-1"
      />,
    );

    fireEvent.press(screen.getByText('3 replies'));

    await waitFor(() => {
      expect(mockFetchThreadMessages).toHaveBeenCalledWith(
        'org-1',
        'channel-1',
        'thread-1',
        'msg-1',
        'user-1',
        'acc-1',
      );
    });

    await waitFor(() => {
      expect(mockMarkThreadReadState).toHaveBeenCalledWith({
        orgId: 'org-1',
        accountId: 'acc-1',
        profileId: 'user-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        lastReadMessageId: 'reply-1',
      });
    });
  });

  it('renders the visibility badge for sender-only messages', () => {
    render(
      <MessageItem
        message={senderOnlyMessage}
        isOwn={false}
        isGroupStart
        colors={colors}
      />,
    );

    expect(screen.getByTestId('message-visibility-badge')).toBeTruthy();
    expect(screen.getByLabelText('Only visible to you')).toBeTruthy();
  });

  it('renders the visibility badge for specific-users messages', () => {
    render(
      <MessageItem
        message={specificUsersMessage}
        isOwn={false}
        isGroupStart
        colors={colors}
      />,
    );

    expect(screen.getByTestId('message-visibility-badge')).toBeTruthy();
    expect(screen.getByLabelText('Visible to specific users')).toBeTruthy();
  });

  it('opens PDF attachments in the in-app PDF viewer instead of the generic browser flow', () => {
    render(
      <MessageItem message={pdfFileMessage} isOwn={false} isGroupStart colors={colors} />,
    );

    fireEvent.press(screen.getByLabelText('Open Worksheet.pdf'));

    expect(screen.getByText('PDF viewer:Worksheet.pdf')).toBeTruthy();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
  });
});
