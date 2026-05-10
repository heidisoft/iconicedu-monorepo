import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseLocalSearchParams = jest.fn();
const mockUseRouter = jest.fn(() => ({ back: jest.fn() }));
const mockUseIsFocused = jest.fn(() => true);
const mockUseQuery = jest.fn();
const mockRefetch = jest.fn();
const mockQueryClient = {
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  refetchQueries: jest.fn(),
};
const mockUseOnlineProfileIds = jest.fn(() => new Map());
const mockUseProfilePresenceSummary = jest.fn(() => ({
  status: 'offline',
  lastSeenAt: null,
}));

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
      profile: [{ id: 'prof-1', display_name: 'Me', first_name: 'Me' }],
    },
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      id: 'prof-1',
      display_name: 'Me',
      first_name: 'Me',
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

jest.mock('@/lib/api/queries', () => ({
  queryKeys: {
    directMessageChannelMeta: (channelId: string, orgId: string, profileId: string) => [
      'directMessageChannelMeta',
      channelId,
      orgId,
      profileId,
    ],
    channelReadState: (channelId: string, accountId: string) => [
      'channelReadState',
      channelId,
      accountId,
    ],
  },
  fetchDirectMessageChannelMetaByChannelId: jest.fn(async () => null),
  fetchChannelReadState: jest.fn(async () => ({
    lastReadMessageId: null,
    unreadCount: 0,
  })),
  markChannelReadState: jest.fn(),
  sendTextMessage: jest.fn(),
  deleteMessage: jest.fn(),
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

jest.mock('@/hooks/use-online-profile-ids', () => ({
  useOnlineProfileIds: (...args: unknown[]) => mockUseOnlineProfileIds(...args),
  useProfilePresenceSummary: (...args: unknown[]) =>
    mockUseProfilePresenceSummary(...args),
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

const mockConversationHeader = jest.fn(() => null);
jest.mock('@/components/messages/conversation-header', () => ({
  ConversationHeader: (props: unknown) => mockConversationHeader(props),
}));

jest.mock('@/components/messages/message-actions-sheet', () => ({
  MessageActionsSheet: () => null,
}));

jest.mock('@/components/messages/channel-info-sheet', () => ({
  ChannelInfoSheet: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────────

import DmConversationScreen from './[channelId]';

function renderScreen() {
  return render(<DmConversationScreen />);
}

function mockDmMeta(meta: Record<string, unknown> | null) {
  mockUseQuery.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
    if (options.queryKey?.[0] === 'directMessageChannelMeta') {
      return { data: meta, isLoading: false };
    }
    return {
      data: {
        lastReadMessageId: null,
        unreadCount: 0,
      },
      isLoading: false,
    };
  });
}

function makeDmMeta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch-1',
    topic: null,
    description: null,
    kind: 'dm',
    participants: [
      {
        id: 'partner-1',
        display_name: 'Alice Chen',
        first_name: 'Alice',
        last_name: 'Chen',
        avatar_seed: 'alice-seed',
        avatar_url: null,
        kind: 'educator',
        timezone: null,
        city: null,
        country_code: null,
        country_name: null,
      },
    ],
    ...overrides,
  };
}

describe('DmConversationScreen — supervised read-only mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnlineProfileIds.mockReturnValue(new Map());
    mockUseProfilePresenceSummary.mockReturnValue({
      status: 'offline',
      lastSeenAt: null,
    });
    mockUseQuery.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
      if (options.queryKey?.[0] === 'directMessageChannelMeta') {
        return { data: null, isLoading: false };
      }
      return {
        data: {
          lastReadMessageId: null,
          unreadCount: 0,
        },
        isLoading: false,
      };
    });
  });

  it('renders MessageInput when not supervised', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
      topic: 'Alice',
    });

    renderScreen();

    expect(screen.getByText('MessageInput')).toBeTruthy();
    expect(screen.queryByText(/read-only mode/i)).toBeNull();
  });

  it('refetches messages when the screen is focused', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
      topic: 'Alice',
    });
    mockUseIsFocused.mockReturnValue(true);

    renderScreen();

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders read-only notice instead of MessageInput when isSupervisedReadOnly=1', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(makeDmMeta({ is_supervised: true, supervised_child_name: 'Alice' }));

    renderScreen();

    expect(screen.getByText(/read-only mode/i)).toBeTruthy();
    expect(screen.queryByText('MessageInput')).toBeNull();
  });

  it('renders MessageInput when isSupervisedReadOnly is absent', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });

    renderScreen();

    expect(screen.getByText('MessageInput')).toBeTruthy();
  });

  it('hydrates the header from DM metadata when opened without route params', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(
      makeDmMeta({
        participants: [
          {
            id: 'partner-1',
            display_name: 'Alice Chen',
            first_name: 'Alice',
            last_name: 'Chen',
            avatar_seed: 'alice-seed',
            avatar_url: 'https://example.test/alice.png',
            kind: 'educator',
            timezone: 'Asia/Colombo',
            city: 'Colombo',
            country_name: 'Sri Lanka',
          },
        ],
      }),
    );

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Alice Chen',
        avatarSeed: 'alice-seed',
        avatarUrl: 'https://example.test/alice.png',
        avatarRole: 'educator',
        localTimeLabel: expect.stringMatching(/^.+$/),
      }),
    );
    expect(mockUseOnlineProfileIds).toHaveBeenCalledWith('org-1', 'prof-1', [
      'partner-1',
    ]);
  });

  it('returns null when channelId is missing', () => {
    mockUseLocalSearchParams.mockReturnValue({});

    const { toJSON } = renderScreen();

    expect(toJSON()).toBeNull();
  });

  it('passes isReadOnly=true to ConversationHeader when supervised', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(makeDmMeta({ is_supervised: true, supervised_child_name: 'Alice' }));

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ isReadOnly: true }),
    );
  });

  it('passes supervised subtitle to ConversationHeader when supervisedChildName provided', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(makeDmMeta({ is_supervised: true, supervised_child_name: 'Senya' }));

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: "Supervising Senya's conversation" }),
    );
  });

  it('passes combined title to ConversationHeader when supervised with both names', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(
      makeDmMeta({
        is_supervised: true,
        supervised_child_name: 'Senya',
        participants: [
          {
            id: 'partner-1',
            display_name: 'Peter',
            first_name: 'Peter',
            last_name: null,
            avatar_seed: 'peter-seed',
            avatar_url: null,
            kind: 'educator',
          },
        ],
      }),
    );

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Peter' }),
    );
  });

  it('passes secondaryAvatarSeed to ConversationHeader when supervised', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(makeDmMeta({ is_supervised: true, supervised_child_name: 'Senya' }));

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ secondaryAvatarSeed: 'Senya' }),
    );
  });

  it('passes local time and icon context when city and country are available', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(
      makeDmMeta({
        participants: [
          {
            id: 'partner-1',
            display_name: 'Alice',
            first_name: 'Alice',
            last_name: null,
            avatar_seed: 'alice-seed',
            avatar_url: null,
            kind: 'educator',
            timezone: 'Asia/Colombo',
            city: 'Colombo',
            country_name: 'Sri Lanka',
          },
        ],
      }),
    );

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        localTimeLabel: expect.stringMatching(/^.+$/),
        localTimeIcon: expect.any(String),
      }),
    );
  });

  it('passes local time and icon context with just country when city is missing', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(
      makeDmMeta({
        participants: [
          {
            id: 'partner-1',
            display_name: 'Alice',
            first_name: 'Alice',
            last_name: null,
            avatar_seed: 'alice-seed',
            avatar_url: null,
            kind: 'educator',
            timezone: 'Asia/Colombo',
            country_code: 'LK',
          },
        ],
      }),
    );

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        localTimeLabel: expect.stringMatching(/^.+$/),
        localTimeIcon: expect.any(String),
      }),
    );
  });

  it('uses the offline local-time context when presence is offline', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(
      makeDmMeta({
        participants: [
          {
            id: 'partner-1',
            display_name: 'Alice',
            first_name: 'Alice',
            last_name: null,
            avatar_seed: 'alice-seed',
            avatar_url: null,
            kind: 'educator',
            timezone: 'Asia/Colombo',
          },
        ],
      }),
    );
    mockUseProfilePresenceSummary.mockReturnValue({
      status: 'offline',
      lastSeenAt: null,
    });

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        localTimeIcon: 'offline',
        localTimeLabel: expect.stringMatching(/^.+$/),
      }),
    );
  });

  it('passes fallback supervised subtitle when supervisedChildName is absent', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
    });
    mockDmMeta(makeDmMeta({ is_supervised: true, supervised_child_name: null }));

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'Supervised Inbox' }),
    );
  });

  it('passes isReadOnly=false to ConversationHeader when not supervised', () => {
    mockUseLocalSearchParams.mockReturnValue({
      channelId: 'ch-1',
      topic: 'Alice',
    });

    renderScreen();

    expect(mockConversationHeader).toHaveBeenCalledWith(
      expect.objectContaining({ isReadOnly: false }),
    );
  });
});
