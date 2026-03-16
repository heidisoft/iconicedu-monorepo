import type {
  ThreadReadStateRow,
  ThreadRow,
  ThreadVM,
  ThreadReadStateVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

type ThreadMapperInput = {
  participants: UserProfileVM[];
  readState?: ThreadReadStateRow | null;
};

export function mapThreadReadStateRow(row: ThreadReadStateRow): ThreadReadStateVM {
  return {
    threadId: row.thread_id,
    channelId: row.channel_id ?? undefined,
    lastReadMessageId: row.last_read_message_id ?? undefined,
    lastReadAt: row.last_read_at ?? undefined,
    unreadCount: row.unread_count ?? undefined,
  };
}

export function mapThreadRowToVM(row: ThreadRow, input: ThreadMapperInput): ThreadVM {
  return {
    ids: {
      id: row.id,
      orgId: row.org_id,
    },
    parent: {
      messageId: row.parent_message_id,
      snippet: row.snippet ?? undefined,
      authorId: row.author_id ?? undefined,
      authorName: row.author_name ?? undefined,
    },
    stats: {
      messageCount: row.message_count ?? 0,
      lastReplyAt: row.last_reply_at ?? row.created_at,
    },
    participants: input.participants,
    readState: input.readState ? mapThreadReadStateRow(input.readState) : undefined,
  };
}
