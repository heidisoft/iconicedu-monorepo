import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MessageVM,
  MessageRow,
  UserProfileVM,
  ThreadVM,
  ReactionVM,
} from '@iconicedu/shared-types';

import {
  getMessagesByChannelId,
  getMessagesPageByChannelId,
  getMessageById,
  getMessageTextByMessageIds,
  getMessagesByThreadId,
  getMessageImagesByMessageIds,
  getMessageFilesByMessageIds,
  getMessageDesignFileUpdatesByMessageIds,
  getMessagePaymentRemindersByMessageIds,
  getMessageEventRemindersByMessageIds,
  getMessageFeedbackRequestsByMessageIds,
  getMessageLessonAssignmentsByMessageIds,
  getMessageProgressUpdatesByMessageIds,
  getMessageSessionBookingsByMessageIds,
  getMessageSessionCompletesByMessageIds,
  getMessageSessionSummariesByMessageIds,
  getMessageHomeworkSubmissionsByMessageIds,
  getMessageLinkPreviewsByMessageIds,
  getMessageAudioRecordingsByMessageIds,
  getMessageLiveSessionStartedByMessageIds,
  getMessageReactionCountsByMessageIds,
  getMessageSavesByMessageIds,
} from '@iconicedu/web/lib/messages/queries/messages.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapMessageRowToVM } from '@iconicedu/web/lib/messages/mappers/message.mapper';
import { buildThreadById } from '@iconicedu/web/lib/messages/builders/thread.builder';

type MessageBuildOptions = {
  threadsById?: Map<string, ThreadVM>;
  limit?: number;
  beforeCreatedAt?: string | null;
  accountId?: string;
  profileId?: string;
};

export async function buildMessagesByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: MessageBuildOptions = {},
): Promise<MessageVM[]> {
  const rows =
    options.limit || options.beforeCreatedAt
      ? (
          await getMessagesPageByChannelId(supabase, orgId, channelId, {
            limit: options.limit ?? 50,
            beforeCreatedAt: options.beforeCreatedAt,
          })
        ).data ?? []
      : (await getMessagesByChannelId(supabase, orgId, channelId)).data ?? [];
  if (!rows.length) {
    return [];
  }
  return mapRowsToMessages(supabase, orgId, rows, options);
}

export async function buildMessagesPageByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: {
    limit: number;
    beforeCreatedAt?: string | null;
    threadsById?: Map<string, ThreadVM>;
  },
): Promise<{
  messages: MessageVM[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const response = await getMessagesPageByChannelId(supabase, orgId, channelId, {
    limit: options.limit,
    beforeCreatedAt: options.beforeCreatedAt,
  });
  const rows = response.data ?? [];
  if (!rows.length) {
    return {
      messages: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  return {
    messages: await mapRowsToMessages(supabase, orgId, rows, options),
    hasMore: response.hasMore,
    nextCursor: response.nextCursor,
  };
}

export async function buildMessageById(
  supabase: SupabaseClient,
  orgId: string,
  messageId: string,
  options: MessageBuildOptions = {},
): Promise<MessageVM | null> {
  const messageResponse = await getMessageById(supabase, orgId, messageId);
  const row = messageResponse.data ?? null;
  if (!row) {
    return null;
  }

  const [payloadsById, reactionsByMessageId, sender, thread, savedMessageIds] = await Promise.all([
    loadPayloadsByMessageIds(supabase, orgId, [row]),
    loadReactionsByMessageIds(supabase, orgId, [row.id]),
    buildUserProfileById(supabase, row.sender_profile_id),
    row.thread_id
      ? buildThreadById(supabase, orgId, row.thread_id, {
          accountId: options.accountId,
        })
      : Promise.resolve(null),
    loadSavedMessageIds(supabase, orgId, options.profileId, [row.id]),
  ]);

  if (!sender) {
    return null;
  }

  return mapMessageRowToVM(
    {
      ...row,
      is_saved: savedMessageIds.has(row.id),
    },
    {
    sender,
    payload: payloadsById.get(row.id) ?? null,
    reactions: reactionsByMessageId.get(row.id) ?? [],
    thread: thread ?? (row.thread_id ? options.threadsById?.get(row.thread_id) : undefined),
    },
  );
}

export async function buildMessagesByThreadId(
  supabase: SupabaseClient,
  orgId: string,
  threadId: string,
  options: { accountId?: string; profileId?: string; parentMessageId?: string | null } = {},
): Promise<MessageVM[]> {
  const response = await getMessagesByThreadId(supabase, orgId, threadId, {
    parentMessageId: options.parentMessageId,
  });
  const threadRows = response.data ?? [];

  const parentRows = options.parentMessageId
    ? [await getMessageById(supabase, orgId, options.parentMessageId)]
    : [];
  const parentRow = parentRows[0]?.data ?? null;

  const rowsById = new Map<string, MessageRow>();
  if (parentRow) {
    rowsById.set(parentRow.id, parentRow);
  }
  threadRows.forEach((row) => rowsById.set(row.id, row));
  const rows = Array.from(rowsById.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (!rows.length) return [];

  const thread = await buildThreadById(supabase, orgId, threadId, {
    accountId: options.accountId,
  });
  const threadsById = thread ? new Map([[threadId, thread]]) : undefined;

  const mapped = await mapRowsToMessages(supabase, orgId, rows, {
    threadsById,
    accountId: options.accountId,
    profileId: options.profileId,
  });
  if (!thread || !options.parentMessageId) {
    return mapped;
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  return mapped.map((message) => {
    const sourceRow = rowById.get(message.ids.id);
    if (!sourceRow) return message;
    if (message.social.thread) return message;
    if (sourceRow.thread_parent_id !== options.parentMessageId) return message;
    return {
      ...message,
      social: {
        ...message.social,
        thread,
      },
    };
  });
}

async function loadPayloadsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  rows: MessageRow[],
): Promise<Map<string, Record<string, unknown>>> {
  const idsByType = new Map<string, string[]>();
  rows.forEach((row) => {
    const bucket = idsByType.get(row.type) ?? [];
    bucket.push(row.id);
    idsByType.set(row.type, bucket);
  });

  const payloadMap = new Map<string, Record<string, unknown>>();

  const loaders: Array<Promise<void>> = [
    loadPayloads(getMessageTextByMessageIds, 'text'),
    loadPayloads(getMessageImagesByMessageIds, 'image'),
    loadPayloads(getMessageFilesByMessageIds, 'file'),
    loadPayloads(getMessageDesignFileUpdatesByMessageIds, 'design-file-update'),
    loadPayloads(getMessagePaymentRemindersByMessageIds, 'payment-reminder'),
    loadPayloads(getMessageEventRemindersByMessageIds, 'event-reminder'),
    loadPayloads(getMessageFeedbackRequestsByMessageIds, 'feedback-request'),
    loadPayloads(getMessageLessonAssignmentsByMessageIds, 'lesson-assignment'),
    loadPayloads(getMessageProgressUpdatesByMessageIds, 'progress-update'),
    loadPayloads(getMessageSessionBookingsByMessageIds, 'session-booking'),
    loadPayloads(getMessageSessionCompletesByMessageIds, 'session-complete'),
    loadPayloads(getMessageSessionSummariesByMessageIds, 'session-summary'),
    loadPayloads(getMessageHomeworkSubmissionsByMessageIds, 'homework-submission'),
    loadPayloads(getMessageLinkPreviewsByMessageIds, 'link-preview'),
    loadPayloads(getMessageAudioRecordingsByMessageIds, 'audio-recording'),
    loadPayloads(getMessageLiveSessionStartedByMessageIds, 'live-session-started'),
  ];

  await Promise.all(loaders);
  rows
    .filter((row) => row.type === 'file' || row.type === 'image' || row.type === 'audio-recording')
    .forEach((row) => {
      const payload = payloadMap.get(row.id);
      if (!payload || typeof payload.url !== 'string') {
        return;
      }

      const normalizedAttachments = Array.isArray(payload.attachments)
        ? payload.attachments.map((attachment) => {
            if (
              !attachment ||
              typeof attachment !== 'object' ||
              typeof attachment.url !== 'string'
            ) {
              return attachment;
            }

            return {
              ...attachment,
              storagePath:
                typeof attachment.storagePath === 'string'
                  ? attachment.storagePath
                  : attachment.url,
            };
          })
        : undefined;

      payloadMap.set(row.id, {
        ...payload,
        storagePath: typeof payload.storagePath === 'string' ? payload.storagePath : payload.url,
        ...(normalizedAttachments ? { attachments: normalizedAttachments } : {}),
      });
    });

  return payloadMap;

  async function loadPayloads(
    fetcher: (supabase: SupabaseClient, orgId: string, ids: string[]) => Promise<{ data: { message_id: string; payload: Record<string, unknown> }[] | null }>,
    type: string,
  ) {
    const ids = idsByType.get(type) ?? [];
    if (!ids.length) {
      return;
    }
    const response = await fetcher(supabase, orgId, ids);
    response.data?.forEach((row) => {
      payloadMap.set(row.message_id, row.payload);
    });
  }
}

async function loadReactionsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
): Promise<Map<string, ReactionVM[]>> {
  const response = await getMessageReactionCountsByMessageIds(
    supabase,
    orgId,
    messageIds,
  );
  const rows = response.data ?? [];
  const grouped = groupBy(rows, (row) => row.message_id);
  const result = new Map<string, ReactionVM[]>();
  grouped.forEach((items, messageId) => {
    result.set(
      messageId,
      items.map((item) => ({
        emoji: item.emoji,
        count: item.count,
      })),
    );
  });
  return result;
}

async function resolveProfilesById(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, UserProfileVM>> {
  const profiles = await Promise.all(
    profileIds.map((profileId) => buildUserProfileById(supabase, profileId)),
  );
  const map = new Map<string, UserProfileVM>();
  profiles.forEach((profile) => {
    if (profile) {
      map.set(profile.ids.id, profile);
    }
  });
  return map;
}

async function mapRowsToMessages(
  supabase: SupabaseClient,
  orgId: string,
  rows: MessageRow[],
  options: Pick<MessageBuildOptions, 'threadsById' | 'profileId' | 'accountId'> = {},
) {
  const messageIds = rows.map((row) => row.id);
  const [payloadsById, reactionsByMessageId, profilesById, savedMessageIds] = await Promise.all([
    loadPayloadsByMessageIds(supabase, orgId, rows),
    loadReactionsByMessageIds(supabase, orgId, messageIds),
    resolveProfilesById(
      supabase,
      Array.from(new Set(rows.map((row) => row.sender_profile_id))),
    ),
    loadSavedMessageIds(supabase, orgId, options.profileId, messageIds),
  ]);

  return rows
    .map((row) => {
      const sender = profilesById.get(row.sender_profile_id);
      if (!sender) {
        return null;
      }
      return mapMessageRowToVM(
        {
          ...row,
          is_saved: savedMessageIds.has(row.id),
        },
        {
        sender,
        payload: payloadsById.get(row.id) ?? null,
        reactions: reactionsByMessageId.get(row.id) ?? [],
        thread: row.thread_id ? options.threadsById?.get(row.thread_id) : undefined,
        },
      );
    })
    .filter((message): message is MessageVM => Boolean(message));
}

async function loadSavedMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string | undefined,
  messageIds: string[],
): Promise<Set<string>> {
  if (!profileId || !messageIds.length) {
    return new Set();
  }

  const response = await getMessageSavesByMessageIds(supabase, orgId, profileId, messageIds);
  return new Set((response.data ?? []).map((row) => row.message_id));
}

function groupBy<T, K extends string>(
  rows: T[],
  getKey: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}
