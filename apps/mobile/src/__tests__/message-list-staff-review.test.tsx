import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessageList } from '@/components/messages/message-list';
import type { MessageVM } from '@iconicedu/shared-types';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

const mockFetchThreadMessages = jest.fn(async () => []);

jest.mock('@/lib/api/queries', () => ({
  fetchThreadMessages: (...args: unknown[]) => mockFetchThreadMessages(...args),
  markThreadReadState: jest.fn(),
  queryKeys: {
    messages: (channelId: string, profileId = '') => ['messages', channelId, profileId],
  },
}));

function makeMessage(visibility: MessageVM['core']['visibility']): MessageVM {
  return {
    ids: { id: 'private-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        kind: 'educator',
        ids: { id: 'tutor-1', orgId: 'org-1', accountId: 'acc-tutor-1' },
        profile: {
          displayName: 'Taylor Tutor',
          avatar: { source: 'seed' as const, seed: 'tutor-1', url: null },
        },
        prefs: {},
        meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
      },
      createdAt: '2025-12-17T10:00:00Z',
      visibility,
    },
    social: { reactions: [] },
    state: {},
    content: { text: 'He was unwell this week' },
  } as unknown as MessageVM;
}

const privateMessage = makeMessage({
  type: 'specific-users',
  userIds: ['tutor-1', 'parent-1'],
});
const reactionDisabled = () =>
  screen.getByLabelText('Add emoji reaction').props.accessibilityState?.disabled;

describe('MessageList staff review of private messages (classic theme)', () => {
  it('shows the message read-only to a viewer outside the audience', () => {
    render(
      <MessageList
        messages={[privateMessage]}
        currentProfileId="staff-1"
        onReactionToggle={jest.fn()}
      />,
    );
    expect(screen.getByText('He was unwell this week')).toBeTruthy();
    expect(reactionDisabled()).toBe(true);
  });

  it.each(['parent-1', 'tutor-1'])('stays interactive for audience member %s', (id) => {
    render(
      <MessageList
        messages={[privateMessage]}
        currentProfileId={id}
        onReactionToggle={jest.fn()}
      />,
    );
    expect(reactionDisabled()).toBe(false);
  });

  it('keeps everyone messages interactive for staff', () => {
    render(
      <MessageList
        messages={[makeMessage({ type: 'all' })]}
        currentProfileId="staff-1"
        onReactionToggle={jest.fn()}
      />,
    );
    expect(reactionDisabled()).toBe(false);
  });
});

describe('MessageList staff review: threads and labelling (classic theme)', () => {
  const withThread = {
    ...privateMessage,
    social: {
      reactions: [],
      thread: {
        ids: { id: 'thread-1', orgId: 'org-1' },
        parent: { messageId: 'private-1' },
        stats: { messageCount: 2, lastReplyAt: '2025-12-17T10:05:00Z' },
        participants: [],
      },
    },
  } as unknown as MessageVM;

  beforeEach(() => mockFetchThreadMessages.mockClear());

  it('lets a staff reviewer expand and read the replies', async () => {
    render(
      <MessageList
        messages={[withThread]}
        currentProfileId="staff-1"
        channelId="channel-1"
        onThreadOpen={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('2 replies'));
    await waitFor(() => expect(mockFetchThreadMessages).toHaveBeenCalled());
  });

  it('labels the badge as a read-only staff view', () => {
    render(<MessageList messages={[privateMessage]} currentProfileId="staff-1" />);
    expect(screen.getByLabelText(/Staff view, read-only/)).toBeTruthy();
  });

  it('does not label the badge for audience members', () => {
    render(<MessageList messages={[privateMessage]} currentProfileId="parent-1" />);
    expect(screen.queryByLabelText(/Staff view/)).toBeNull();
  });
});
