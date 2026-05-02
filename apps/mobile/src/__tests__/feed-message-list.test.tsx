import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { FlatList, StyleSheet } from 'react-native';
import type {
  AudioRecordingMessageVM,
  FileAttachmentVM,
  ImageAttachmentVM,
  MessageVM,
  ReactionVM,
  ThreadVM,
} from '@iconicedu/shared-types';
import { FeedMessageList } from '@/components/messages/themes/feed-message-list';
import { resolveMobileMessageUiTheme } from '@/components/messages/themes/registry';
import { lightColors as mockLightColors } from '@/lib/theme';

const mockFetchThreadMessages = jest.fn();
const mockUseOnlineProfileIds = jest.fn(() => new Map());
const mockMarkThreadRead = jest.fn();

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: mockLightColors }),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchThreadMessages: (...args: unknown[]) => mockFetchThreadMessages(...args),
}));

jest.mock('@/hooks/use-online-profile-ids', () => ({
  useOnlineProfileIds: (...args: unknown[]) => mockUseOnlineProfileIds(...args),
}));

jest.mock('@/hooks/use-mark-read', () => ({
  useMarkRead: () => ({ markThreadRead: mockMarkThreadRead }),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: jest.fn(async (path: string) => ({
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        })),
      }),
    },
  },
}));

function makeSender(
  id: string,
  name: string,
  kind = 'educator',
  presence?: MessageVM['core']['sender']['presence'],
) {
  return {
    kind,
    ids: { id, orgId: 'org-1', accountId: `acc-${id}` },
    profile: {
      displayName: name,
      avatar: {
        source: 'seed' as const,
        seed: id,
        url: null,
        updatedAt: '2025-01-01T00:00:00Z',
      },
    },
    presence,
    prefs: {},
    meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  } as unknown as MessageVM['core']['sender'];
}

function makeTextMessage(
  id: string,
  text: string,
  input?: {
    senderId?: string;
    senderName?: string;
    thread?: ThreadVM;
    reactions?: ReactionVM[];
    presence?: MessageVM['core']['sender']['presence'];
  },
): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender(
        input?.senderId ?? 'profile-1',
        input?.senderName ?? 'Mark T',
        'educator',
        input?.presence,
      ),
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: input?.reactions ?? [], thread: input?.thread },
    state: {},
    content: { text },
  } as unknown as MessageVM;
}

function makeImageMessage(count: number): MessageVM {
  const attachments: ImageAttachmentVM[] = Array.from({ length: count }, (_, index) => ({
    type: 'image',
    url: `https://example.com/image-${index}.jpg`,
    name: `image-${index}.jpg`,
    width: 600,
    height: 600,
  }));

  return {
    ids: { id: `image-${count}`, orgId: 'org-1' },
    core: {
      type: 'image',
      sender: makeSender('profile-1', 'Mark T'),
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text: 'Photo update' },
    attachment: attachments[0],
    attachments,
  } as unknown as MessageVM;
}

function makeFileMessage(text = 'Please review this file.'): MessageVM {
  const attachment: FileAttachmentVM = {
    type: 'file',
    url: 'https://example.com/worksheet.pdf',
    name: 'worksheet.pdf',
    mimeType: 'application/pdf',
    size: 123_000,
  };

  return {
    ids: { id: 'file-1', orgId: 'org-1' },
    core: {
      type: 'file',
      sender: makeSender('profile-1', 'Mark T'),
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text },
    attachment,
  } as unknown as MessageVM;
}

function makeAudioMessage(text = 'Audio note for context.'): MessageVM {
  return {
    ids: { id: 'audio-1', orgId: 'org-1' },
    core: {
      type: 'audio-recording',
      sender: makeSender('profile-1', 'Mark T'),
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text },
    audio: {
      url: 'https://example.com/audio.m4a',
      durationSeconds: 12,
      mimeType: 'audio/mp4',
      waveform: [0.2, 0.5, 0.8],
    },
  } as unknown as AudioRecordingMessageVM;
}

describe('FeedMessageList', () => {
  beforeEach(() => {
    mockFetchThreadMessages.mockReset();
    mockUseOnlineProfileIds.mockReset();
    mockUseOnlineProfileIds.mockReturnValue(new Map());
  });

  it('is selected by the mobile feed registry', () => {
    const theme = resolveMobileMessageUiTheme('feed');
    expect(theme.key).toBe('feed');
    expect(theme.MessageList).not.toBe(
      resolveMobileMessageUiTheme('classic').MessageList,
    );
  });

  it('renders feed posts instead of classic bubbles', () => {
    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Happy Friday!')]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByTestId('feed-message-list')).toBeTruthy();
    expect(screen.getByTestId('feed-message-post')).toBeTruthy();
    expect(screen.getByText('Happy Friday!')).toBeTruthy();
    expect(screen.getByText('Tutor')).toBeTruthy();
  });

  it('uses the mobile DM bubble colors for feed text cards', () => {
    render(
      <FeedMessageList
        messages={[
          makeTextMessage('msg-other', 'Incoming feed note.', {
            senderId: 'profile-other',
          }),
          makeTextMessage('msg-own', 'My feed note.', {
            senderId: 'profile-current',
          }),
        ]}
        currentProfileId="profile-current"
      />,
    );

    const cards = screen.getAllByTestId('feed-text-card');
    expect(StyleSheet.flatten(cards[0].props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: 'rgba(148, 163, 184, 0.16)',
      }),
    );
    expect(StyleSheet.flatten(cards[1].props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: 'rgba(45, 212, 168, 0.22)',
      }),
    );
  });

  it('renders pending uploads in the footer near latest feed content', () => {
    const onRetryUpload = jest.fn();
    const { UNSAFE_getByType } = render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Happy Friday!')]}
        currentProfileId="profile-current"
        pendingUploads={[
          {
            id: 'pending-1',
            type: 'file',
            attachments: [
              {
                uri: 'file:///tmp/lesson.pdf',
                name: 'lesson.pdf',
                mimeType: 'application/pdf',
              },
            ],
            senderName: 'Tutor',
            createdAt: '2025-01-15T10:31:00Z',
            caption: 'Uploading lesson plan',
            failed: true,
          },
        ]}
        onRetryUpload={onRetryUpload}
      />,
    );

    const list = UNSAFE_getByType(FlatList);
    expect(list.props.ListHeaderComponent).toBeUndefined();
    expect(list.props.ListFooterComponent).toBeTruthy();
    expect(screen.getByText('Uploading lesson plan')).toBeTruthy();

    fireEvent.press(screen.getByText('Failed to send · tap to retry'));
    expect(onRetryUpload).toHaveBeenCalledWith('pending-1');
  });

  it('shows sender presence on feed avatars', () => {
    mockUseOnlineProfileIds.mockReturnValue(new Map([['profile-1', 'online']]));

    render(
      <FeedMessageList
        messages={[
          makeTextMessage('msg-1', 'I am online.', {
            presence: { state: {}, liveStatus: 'offline', displayStatus: 'offline' },
          }),
        ]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByTestId('message-avatar-presence')).toBeTruthy();
    expect(screen.getByText('Tutor')).toBeTruthy();
    expect(screen.queryByText('Tutor · Online')).toBeNull();
    expect(mockUseOnlineProfileIds).toHaveBeenCalledWith('org-1', 'profile-current', [
      'profile-1',
    ]);
  });

  it('uses emoji reactions and reply counts without share actions', () => {
    const thread = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'msg-1' },
      stats: { messageCount: 2, lastReplyAt: '2025-01-15T10:35:00Z' },
      participants: [],
    } as unknown as ThreadVM;

    render(
      <FeedMessageList
        messages={[
          makeTextMessage('msg-1', 'React to this.', {
            thread,
            reactions: [{ emoji: '👍', count: 3, reactedByMe: true }],
          }),
        ]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Add emoji reaction')).toBeTruthy();
    expect(screen.getByText('2 replies')).toBeTruthy();
    expect(screen.queryByText('Share')).toBeNull();
  });

  it('shows Reply text on main feed messages but not thread reply cards', async () => {
    const thread = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'msg-threaded' },
      stats: { messageCount: 1, lastReplyAt: '2025-01-15T10:35:00Z' },
      participants: [],
    } as unknown as ThreadVM;
    mockFetchThreadMessages.mockResolvedValue([
      makeTextMessage('reply-1', 'Thread reply.', {
        senderId: 'profile-2',
        senderName: 'Taras H',
      }),
    ]);

    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Main message.', { thread: undefined })]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByText('Reply')).toBeTruthy();

    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-threaded', 'Threaded message.', { thread })]}
        channelId="channel-1"
        currentProfileId="profile-current"
        currentAccountId="account-1"
      />,
    );

    fireEvent.press(screen.getByText('1 reply'));

    await waitFor(() => {
      const commentCard = within(screen.getByTestId('feed-comment-card'));
      expect(commentCard.getByLabelText('Reply to thread')).toBeTruthy();
      expect(commentCard.queryByText('Reply')).toBeNull();
    });
  });

  it('opens profiles only from the avatar or sender name', () => {
    const onProfilePress = jest.fn();

    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Tap targets only.')]}
        currentProfileId="profile-current"
        onProfilePress={onProfilePress}
      />,
    );

    fireEvent.press(screen.getByTestId('feed-message-post'));
    expect(onProfilePress).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Mark T profile name'));
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  it('opens message actions from long press and the more button', () => {
    const onMessageLongPress = jest.fn();

    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Actions please.')]}
        currentProfileId="profile-current"
        onMessageLongPress={onMessageLongPress}
      />,
    );

    fireEvent(screen.getByTestId('feed-message-post'), 'longPress');
    expect(onMessageLongPress).toHaveBeenCalledWith(
      expect.objectContaining({ ids: expect.objectContaining({ id: 'msg-1' }) }),
    );

    fireEvent.press(screen.getByLabelText('More message actions'));
    expect(onMessageLongPress).toHaveBeenCalledTimes(2);
  });

  it('renders single, two-image, and collage image grids', () => {
    render(
      <FeedMessageList
        messages={[makeImageMessage(1), makeImageMessage(2), makeImageMessage(5)]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByTestId('feed-image-grid-single')).toBeTruthy();
    expect(screen.getByTestId('feed-image-grid-two')).toBeTruthy();
    expect(screen.getByTestId('feed-image-grid-collage')).toBeTruthy();
    expect(screen.getByText('1+')).toBeTruthy();
  });

  it('renders captions for image, file, and audio feed messages', () => {
    render(
      <FeedMessageList
        messages={[
          makeImageMessage(1),
          makeFileMessage(
            'File caption text that should wrap inside the same bordered caption card as image and audio messages.',
          ),
          makeAudioMessage('Audio caption text.'),
        ]}
        currentProfileId="profile-current"
      />,
    );

    expect(screen.getByText('Photo update')).toBeTruthy();
    expect(
      screen.getByText(
        'File caption text that should wrap inside the same bordered caption card as image and audio messages.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Audio caption text.')).toBeTruthy();
    expect(screen.getByLabelText('Open worksheet.pdf')).toBeTruthy();
    expect(screen.getByLabelText('Play audio')).toBeTruthy();
  });

  it('renders fetched thread replies as comment cards', async () => {
    const thread = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'msg-1' },
      stats: { messageCount: 1, lastReplyAt: '2025-01-15T10:35:00Z' },
      participants: [],
    } as unknown as ThreadVM;
    mockFetchThreadMessages.mockResolvedValue([
      makeTextMessage('reply-1', 'That was fast.', {
        senderId: 'profile-2',
        senderName: 'Taras H',
      }),
    ]);
    const onReactionToggle = jest.fn();
    const onThreadOpen = jest.fn();

    render(
      <FeedMessageList
        messages={[makeTextMessage('msg-1', 'Photo update', { thread })]}
        channelId="channel-1"
        currentProfileId="profile-current"
        currentAccountId="account-1"
        onReactionToggle={onReactionToggle}
        onThreadOpen={onThreadOpen}
      />,
    );

    fireEvent.press(screen.getByText('1 reply'));

    await waitFor(() => {
      expect(screen.getByTestId('feed-comment-card')).toBeTruthy();
      expect(screen.getByText('That was fast.')).toBeTruthy();
    });

    const commentCard = within(screen.getByTestId('feed-comment-card'));
    expect(commentCard.getByLabelText('Add emoji reaction')).toBeTruthy();
    expect(commentCard.getByLabelText('Reply to thread')).toBeTruthy();

    fireEvent.press(commentCard.getByLabelText('Reply to thread'));
    expect(onThreadOpen).toHaveBeenCalledWith(
      expect.objectContaining({ ids: expect.objectContaining({ id: 'msg-1' }) }),
    );

    fireEvent.press(commentCard.getByLabelText('Add emoji reaction'));
    await waitFor(() => expect(screen.getByLabelText('Gestures')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Gestures'));
    await waitFor(() => expect(screen.getAllByText('👍')[0]).toBeTruthy());
    fireEvent.press(screen.getAllByText('👍')[0]);
    expect(onReactionToggle).toHaveBeenCalledWith('reply-1', '👍');
    expect(commentCard.getByText('👍')).toBeTruthy();
    expect(commentCard.getByText('1')).toBeTruthy();
  });
});
