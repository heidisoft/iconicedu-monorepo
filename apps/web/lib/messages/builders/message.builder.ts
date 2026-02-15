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
  getMessageReactionCountsByMessageIds,
} from '@iconicedu/web/lib/messages/queries/messages.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapMessageRowToVM } from '@iconicedu/web/lib/messages/mappers/message.mapper';
import { buildThreadById } from '@iconicedu/web/lib/messages/builders/thread.builder';

type MessageBuildOptions = {
  threadsById?: Map<string, ThreadVM>;
  limit?: number;
  beforeCreatedAt?: string | null;
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
  return mapRowsToMessages(supabase, orgId, rows, options.threadsById);
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
    messages: await mapRowsToMessages(supabase, orgId, rows, options.threadsById),
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

  const [payloadsById, reactionsByMessageId, sender, thread] = await Promise.all([
    loadPayloadsByMessageIds(supabase, orgId, [row]),
    loadReactionsByMessageIds(supabase, orgId, [row.id]),
    buildUserProfileById(supabase, row.sender_profile_id),
    row.thread_id ? buildThreadById(supabase, orgId, row.thread_id) : Promise.resolve(null),
  ]);

  if (!sender) {
    return null;
  }

  return mapMessageRowToVM(row, {
    sender,
    payload: payloadsById.get(row.id) ?? null,
    reactions: reactionsByMessageId.get(row.id) ?? [],
    thread: thread ?? (row.thread_id ? options.threadsById?.get(row.thread_id) : undefined),
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
  ];

  await Promise.all(loaders);

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
  threadsById?: Map<string, ThreadVM>,
) {
  const messageIds = rows.map((row) => row.id);
  const payloadsById = await loadPayloadsByMessageIds(supabase, orgId, rows);
  const reactionsByMessageId = await loadReactionsByMessageIds(supabase, orgId, messageIds);
  const profilesById = await resolveProfilesById(
    supabase,
    Array.from(new Set(rows.map((row) => row.sender_profile_id))),
  );

  return rows
    .map((row) => {
      const sender = profilesById.get(row.sender_profile_id);
      if (!sender) {
        return null;
      }
      return mapMessageRowToVM(row, {
        sender,
        payload: payloadsById.get(row.id) ?? null,
        reactions: reactionsByMessageId.get(row.id) ?? [],
        thread: row.thread_id ? threadsById?.get(row.thread_id) : undefined,
      });
    })
    .filter((message): message is MessageVM => Boolean(message));
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
