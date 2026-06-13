import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockUseLocalSearchParams = jest.fn();
const mockUseRouter = jest.fn(() => ({ back: jest.fn() }));
const mockUseIsFocused = jest.fn(() => true);
const mockFetchIsChannelMember = jest.fn();
const mockConversationHeader = jest.fn(() => null);
const mockUseQuery = jest.fn();
const mockRefetch = jest.fn();
const mockQueryClient = {
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  refetchQueries: jest.fn(),
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
  useRouter: (...args: unknown[]) => mockUseRouter(...args),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: (...args: unknown[]) => mockUseIsFocused(...args),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({
    data: {
      org_id: 'org-1',
      id: 'acct-1',
    },
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      id: 'prof-1',
      kind: 'staff',
      display_name: 'Staff User',
      first_name: 'Staff',
    },
  }),
}));

jest.mock('@/hooks/use-messages', () => ({
  useMessages: () => ({
    data: [],
    isLoading: false,
    isRefetching: false,
    refetch: mockRefetch,
    loadMore: jest.fn(),
    toggleReaction: jest.fn(),
    typingUsers: [],
    broadcastTyping: jest.fn(),
    broadcastTypingStop: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-space-sessions', () => ({
  useSpaceSessions: () => ({
    schedules: [],
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  queryKeys: {
    spaceChannelMeta: (channelId: string) => ['spaceChannelMeta', channelId],
    channelReadState: (channelId: string, accountId: string) => [
      'channelReadState',
      channelId,
      accountId,
    ],
    channelMembership: (orgId: string, channelId: string, profileId: string) => [
      'channelMembership',
      orgId,
      channelId,
      profileId,
    ],
  },
  fetchSpaceChannelMetaByChannelId: jest.fn(async () => null),
  fetchChannelReadState: jest.fn(async () => ({
    lastReadMessageId: null,
    unreadCount: 0,
  })),
  fetchIsChannelMember: (...args: unknown[]) => mockFetchIsChannelMember(...args),
  markChannelReadState: jest.fn(),
  sendTextMessage: jest.fn(),
  sendFileMessage: jest.fn(),
  sendFilesMessage: jest.fn(),
  uploadChannelFile: jest.fn(),
  buildMessageStoragePath: jest.fn(),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#ffffff',
      teal: '#2dd4a8',
      tealBg: '#f0fdfa',
      bg: '#ffffff',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textFaint: '#cbd5e1',
      border: '#e2e8f0',
      inputBg: '#f8fafc',
      card: '#ffffff',
    },
  }),
}));

jest.mock('@/components/messages/message-list', () => ({
  findLatestUnreadIncomingMessageId: () => null,
  MessageList: () => null,
}));

jest.mock('@/components/messages/message-input', () => ({
  MessageInput: () => {
    const { Text } = require('react-native');
    return <Text>MessageInput</Text>;
  },
}));

jest.mock('@/components/messages/typing-indicator', () => ({
  TypingIndicator: () => null,
}));

jest.mock('@/components/messages/conversation-header', () => ({
  ConversationHeader: (props: unknown) => mockConversationHeader(props),
}));

jest.mock('@/components/messages/channel-info-sheet', () => ({
  ChannelInfoSheet: () => null,
}));

jest.mock('@/components/messages/space-sessions-tab', () => ({
  SpaceSessionsTab: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import SpaceDetailScreen from './[channelId]';

function renderScreen() {
  return render(<SpaceDetailScreen />);
}

describe('SpaceDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(
      ({ queryKey }: { queryKey: [string, ...string[]] }) => {
        switch (queryKey[0]) {
          case 'spaceChannelMeta':
            return { data: null, isLoading: false };
          case 'channelReadState':
            return {
              data: {
                lastReadMessageId: null,
                unreadCount: 0,
              },
            };
          case 'channelMembership':
            return { data: mockFetchIsChannelMember(), isLoading: false };
          default:
            return { data: undefined, isLoading: false };
        }
      },
    );
  });

  it('renders the composer for staff observers who are not classroom members', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'channel-1',
      topic: 'Biology',
    });
    mockFetchIsChannelMember.mockReturnValue(false);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('MessageInput')).toBeTruthy();
    });
    expect(screen.queryByText('Read-only supervised conversation')).toBeNull();
    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ isReadOnly: false }),
    );
  });

  it('renders the composer for staff members who belong to the classroom', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'channel-1',
      topic: 'Biology',
    });
    mockFetchIsChannelMember.mockReturnValue(true);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('MessageInput')).toBeTruthy();
    });
    expect(screen.queryByText('Read-only supervised conversation')).toBeNull();
    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ isReadOnly: false }),
    );
  });

  it('refetches messages when the screen is focused', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'channel-1',
      topic: 'Biology',
    });
    mockFetchIsChannelMember.mockReturnValue(true);
    mockUseIsFocused.mockReturnValue(true);

    renderScreen();

    expect(mockRefetch).toHaveBeenCalled();
  });
});
