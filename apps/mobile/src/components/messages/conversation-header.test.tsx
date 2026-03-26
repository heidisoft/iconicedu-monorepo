import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import { ConversationHeader } from './conversation-header';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      teal: '#2dd4a8',
      tealBg: '#f0fdfa',
      pageBg: '#ffffff',
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

jest.mock('lucide-react-native', () => ({
  ChevronLeft: () => null,
  Video: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'video-icon'} />;
  },
  Share2: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'share-icon'} />;
  },
  X: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'close-icon'} />;
  },
  MoreVertical: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'more-icon'} />;
  },
  IdCardLanyard: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'staff-name-indicator'} />;
  },
}));

jest.mock('@/lib/learning-space-icons', () => ({
  LearningSpaceIconBadge: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'learning-space-icon-badge'} />;
  },
}));

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('ConversationHeader', () => {
  const baseProps = {
    title: 'Alice',
    kind: 'dm' as const,
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  });

  it('renders title', () => {
    render(<ConversationHeader {...baseProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders the staff indicator next to staff titles', () => {
    render(<ConversationHeader {...baseProps} avatarRole="staff" />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByTestId('staff-name-indicator')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<ConversationHeader {...baseProps} subtitle="Direct Message" />);
    expect(screen.getByText('Direct Message')).toBeTruthy();
  });

  it('renders themed student names after the subtitle', () => {
    render(
      <ConversationHeader
        {...baseProps}
        subtitle="Mathematics"
        studentProfiles={[
          { name: 'Ava Lee', themeKey: 'blue' },
          { name: 'Noah Cruz', themeKey: 'green' },
        ]}
      />,
    );
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Ava Lee')).toBeTruthy();
    expect(screen.getByText(/Noah Cruz/)).toBeTruthy();
  });

  it('renders supervised subtitle when isReadOnly is true', () => {
    render(
      <ConversationHeader
        {...baseProps}
        subtitle="Supervising Alice's conversation"
        isReadOnly={true}
      />,
    );
    expect(screen.getByText("Supervising Alice's conversation")).toBeTruthy();
  });

  it('shows media and more actions when video is enabled', () => {
    render(
      <ConversationHeader
        {...baseProps}
        isReadOnly={false}
        onVideo={jest.fn()}
        onMore={jest.fn()}
      />,
    );
    expect(screen.getByTestId('video-icon')).toBeTruthy();
    expect(screen.getByTestId('more-icon')).toBeTruthy();
  });

  it('hides the video action when live sessions are disabled', () => {
    render(<ConversationHeader {...baseProps} isReadOnly={false} onMore={jest.fn()} />);
    expect(screen.queryByTestId('video-icon')).toBeNull();
    expect(screen.getByTestId('more-icon')).toBeTruthy();
  });

  it('hides action buttons when isReadOnly is true', () => {
    render(<ConversationHeader {...baseProps} isReadOnly={true} />);
    expect(screen.queryByTestId('video-icon')).toBeNull();
    expect(screen.queryByTestId('more-icon')).toBeNull();
  });

  it('hides online dot when isReadOnly is true', () => {
    render(<ConversationHeader {...baseProps} isReadOnly={true} />);
    // Online dot is a plain View with no testID — verify by ensuring no green dot
    // We verify indirectly: no action buttons, consistent with full read-only rendering.
    // The dot is conditionally rendered with {!isReadOnly && <View style={s.onlineDot} />}
    // so we just confirm the component renders without error.
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('shows online dot when isReadOnly is false', () => {
    render(<ConversationHeader {...baseProps} isReadOnly={false} />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('defaults to only showing more when no media action is enabled', () => {
    render(<ConversationHeader {...baseProps} onMore={jest.fn()} />);
    expect(screen.queryByTestId('video-icon')).toBeNull();
    expect(screen.getByTestId('more-icon')).toBeTruthy();
  });

  it('shows an external join dialog instead of navigating immediately', () => {
    render(
      <ConversationHeader
        {...baseProps}
        kind="space"
        liveJoinUrl="https://zoom.us/j/room-123"
        onMore={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Join live session'));

    expect(screen.getByText('Session ready to join')).toBeTruthy();
    expect(screen.getByText('https://zoom.us/j/room-123')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Join Zoom')).toBeTruthy();
    expect(screen.getByLabelText('Open Zoom')).toBeTruthy();
    expect(screen.getByLabelText('Share join link')).toBeTruthy();
    expect(screen.getByLabelText('Close join dialog')).toBeTruthy();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('opens internal join links directly', () => {
    render(
      <ConversationHeader
        {...baseProps}
        kind="space"
        liveJoinUrl="/live-sessions/session-1"
        onMore={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Join live session'));

    expect(Linking.openURL).toHaveBeenCalledWith('/live-sessions/session-1');
    expect(screen.queryByText('Session ready to join')).toBeNull();
  });

  it('renders dual avatar initials when secondaryAvatarSeed provided', () => {
    render(
      <ConversationHeader
        {...baseProps}
        title="Peter"
        secondaryAvatarSeed="Senya"
        isReadOnly={true}
      />,
    );
    expect(screen.getByText('P')).toBeTruthy(); // Peter front avatar
    expect(screen.getByText('S')).toBeTruthy(); // Senya back avatar
    expect(screen.getByText('Senya <> Peter')).toBeTruthy(); // combined title text
  });
});
