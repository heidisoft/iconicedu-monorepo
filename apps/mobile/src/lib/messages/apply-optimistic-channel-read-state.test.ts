import { QueryClient } from '@tanstack/react-query';
import type { MessageVM } from '@iconicedu/shared-types';
import { queryKeys } from '@/lib/api/queries';
import type { ChannelListItem } from '@/lib/api/types';
import { applyOptimisticThreadReadState } from './apply-optimistic-channel-read-state';

const makeThreadParentMessage = (input: {
  messageId: string;
  threadId: string;
  unreadCount: number;
  lastReadMessageId?: string;
}): MessageVM =>
  ({
    ids: { id: input.messageId, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        kind: 'educator',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        profile: {
          displayName: 'Teacher',
          avatar: {
            source: 'seed',
            seed: 'teacher',
            url: null,
            updatedAt: '2026-04-22T00:00:00.000Z',
          },
        },
        prefs: {},
        meta: {
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
        },
      },
      createdAt: '2026-04-22T00:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
      thread: {
        ids: { id: input.threadId, orgId: 'org-1' },
        parent: { messageId: input.messageId },
        stats: {
          messageCount: 3,
          lastReplyAt: '2026-04-22T00:00:00.000Z',
        },
        participants: [],
        readState: {
          threadId: input.threadId,
          channelId: 'channel-1',
          unreadCount: input.unreadCount,
          lastReadMessageId: input.lastReadMessageId,
        },
      },
    },
    state: {},
    content: { text: 'hello' },
  }) as MessageVM;

describe('applyOptimisticThreadReadState', () => {
  it('clears only the targeted thread and decrements the channel thread aggregate by that thread unread count', () => {
    const queryClient = new QueryClient();
    const messages = [
      makeThreadParentMessage({
        messageId: 'parent-1',
        threadId: 'thread-1',
        unreadCount: 2,
        lastReadMessageId: 'reply-1',
      }),
      makeThreadParentMessage({
        messageId: 'parent-2',
        threadId: 'thread-2',
        unreadCount: 3,
        lastReadMessageId: 'reply-3',
      }),
    ];
    const channelLists: ChannelListItem[] = [
      {
        id: 'channel-1',
        org_id: 'org-1',
        topic: 'Channel 1',
        description: null,
        kind: 'channel',
        updated_at: '2026-04-22T00:00:00.000Z',
        unread_count: 0,
        thread_unread_count: 5,
        last_message_text: 'hello',
        last_message_at: '2026-04-22T00:00:00.000Z',
        last_message_sender: 'Teacher',
      },
    ];

    queryClient.setQueryData(queryKeys.messages('channel-1', 'profile-1'), messages);
    queryClient.setQueryData(
      queryKeys.directMessages('org-1', 'profile-1'),
      channelLists,
    );
    queryClient.setQueryData(
      ['learningSpaceChannels', 'org-1', 'profile-1', 'child'],
      channelLists,
    );
    queryClient.setQueryData(
      queryKeys.supervisedDirectMessages('org-1', 'account-1'),
      channelLists,
    );

    applyOptimisticThreadReadState({
      queryClient,
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-1',
      accountId: 'account-1',
      parentMessageId: 'parent-1',
      lastReadMessageId: 'reply-2',
    });

    const nextMessages =
      queryClient.getQueryData<MessageVM[]>(
        queryKeys.messages('channel-1', 'profile-1'),
      ) ?? [];
    expect(nextMessages[0]?.social.thread?.readState?.unreadCount).toBe(0);
    expect(nextMessages[0]?.social.thread?.readState?.lastReadMessageId).toBe('reply-2');
    expect(nextMessages[0]?.social.thread?.readState?.lastReadAt).toBeTruthy();
    expect(nextMessages[1]?.social.thread?.readState?.unreadCount).toBe(3);

    const nextDirectMessages =
      queryClient.getQueryData<ChannelListItem[]>(
        queryKeys.directMessages('org-1', 'profile-1'),
      ) ?? [];
    const nextLearningSpaces =
      queryClient.getQueryData<ChannelListItem[]>([
        'learningSpaceChannels',
        'org-1',
        'profile-1',
        'child',
      ]) ?? [];
    const nextSupervised =
      queryClient.getQueryData<ChannelListItem[]>(
        queryKeys.supervisedDirectMessages('org-1', 'account-1'),
      ) ?? [];

    expect(nextDirectMessages[0]?.thread_unread_count).toBe(3);
    expect(nextLearningSpaces[0]?.thread_unread_count).toBe(3);
    expect(nextSupervised[0]?.thread_unread_count).toBe(3);
  });
});
