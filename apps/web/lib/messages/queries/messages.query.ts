import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MessageRow,
  ThreadRow,
  MessageReactionRow,
  MessageReactionCountRow,
  ChannelFileRow,
  ChannelMediaRow,
  ThreadParticipantRow,
  ThreadReadStateRow,
  MessageTextRow,
  MessageImageRow,
  MessageFileRow,
  MessageDesignFileUpdateRow,
  MessagePaymentReminderRow,
  MessageEventReminderRow,
  MessageFeedbackRequestRow,
  MessageLessonAssignmentRow,
  MessageProgressUpdateRow,
  MessageSessionBookingRow,
  MessageSessionCompleteRow,
  MessageSessionSummaryRow,
  MessageHomeworkSubmissionRow,
  MessageLinkPreviewRow,
  MessageAudioRecordingRow,
} from '@iconicedu/shared-types';

import {
  MESSAGE_SELECT,
  THREAD_SELECT,
  THREAD_PARTICIPANT_SELECT,
  THREAD_READ_STATE_SELECT,
  MESSAGE_REACTION_SELECT,
  MESSAGE_REACTION_COUNT_SELECT,
  MESSAGE_TEXT_SELECT,
  MESSAGE_IMAGE_SELECT,
  MESSAGE_FILE_SELECT,
  MESSAGE_DESIGN_FILE_UPDATE_SELECT,
  MESSAGE_PAYMENT_REMINDER_SELECT,
  MESSAGE_EVENT_REMINDER_SELECT,
  MESSAGE_FEEDBACK_REQUEST_SELECT,
  MESSAGE_LESSON_ASSIGNMENT_SELECT,
  MESSAGE_PROGRESS_UPDATE_SELECT,
  MESSAGE_SESSION_BOOKING_SELECT,
  MESSAGE_SESSION_COMPLETE_SELECT,
  MESSAGE_SESSION_SUMMARY_SELECT,
  MESSAGE_HOMEWORK_SUBMISSION_SELECT,
  MESSAGE_LINK_PREVIEW_SELECT,
  MESSAGE_AUDIO_RECORDING_SELECT,
  CHANNEL_FILE_SELECT,
  CHANNEL_MEDIA_SELECT,
} from '@iconicedu/web/lib/messages/constants/selects';

export async function getMessagesByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from<MessageRow>('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
}

export async function getMessagesPageByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: {
    limit: number;
    beforeCreatedAt?: string | null;
  },
) {
  const pageSize = Math.max(1, options.limit);
  let query = supabase
    .from<MessageRow>('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (options.beforeCreatedAt) {
    query = query.lt('created_at', options.beforeCreatedAt);
  }

  const response = await query;
  const rows = response.data ?? [];
  const hasMore = rows.length > pageSize;
  const pageRowsDesc = hasMore ? rows.slice(0, pageSize) : rows;
  const pageRowsAsc = [...pageRowsDesc].reverse();

  return {
    ...response,
    data: pageRowsAsc,
    hasMore,
    nextCursor: pageRowsAsc[0]?.created_at ?? null,
  };
}

export async function getMessageById(
  supabase: SupabaseClient,
  orgId: string,
  messageId: string,
) {
  return supabase
    .from<MessageRow>('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .eq('id', messageId)
    .is('deleted_at', null)
    .maybeSingle();
}

export async function getMessagesByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as MessageRow[] };
  }

  return supabase
    .from<MessageRow>('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
}

export async function getThreadsByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from<ThreadRow>('threads')
    .select(THREAD_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null);
}

export async function getThreadById(
  supabase: SupabaseClient,
  orgId: string,
  threadId: string,
) {
  return supabase
    .from<ThreadRow>('threads')
    .select(THREAD_SELECT)
    .eq('org_id', orgId)
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle();
}

export async function getThreadParticipantsByThreadIds(
  supabase: SupabaseClient,
  orgId: string,
  threadIds: string[],
) {
  if (!threadIds.length) {
    return { data: [] as ThreadParticipantRow[] };
  }

  return supabase
    .from<ThreadParticipantRow>('thread_participants')
    .select(THREAD_PARTICIPANT_SELECT)
    .eq('org_id', orgId)
    .in('thread_id', threadIds)
    .is('deleted_at', null);
}

export async function getThreadReadStatesByAccountId(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
) {
  return supabase
    .from<ThreadReadStateRow>('thread_read_state')
    .select(THREAD_READ_STATE_SELECT)
    .eq('org_id', orgId)
    .eq('account_id', accountId)
    .is('deleted_at', null);
}

export async function getMessageReactionsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageReactionRow[] };
  }

  return supabase
    .from<MessageReactionRow>('message_reactions')
    .select(MESSAGE_REACTION_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageReactionCountsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageReactionCountRow[] };
  }

  return supabase
    .from<MessageReactionCountRow>('message_reaction_counts')
    .select(MESSAGE_REACTION_COUNT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageTextByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageTextRow[] };
  }

  return supabase
    .from<MessageTextRow>('message_text')
    .select(MESSAGE_TEXT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageImagesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageImageRow[] };
  }

  return supabase
    .from<MessageImageRow>('message_image')
    .select(MESSAGE_IMAGE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageFilesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageFileRow[] };
  }

  return supabase
    .from<MessageFileRow>('message_file')
    .select(MESSAGE_FILE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageDesignFileUpdatesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageDesignFileUpdateRow[] };
  }

  return supabase
    .from<MessageDesignFileUpdateRow>('message_design_file_update')
    .select(MESSAGE_DESIGN_FILE_UPDATE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessagePaymentRemindersByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessagePaymentReminderRow[] };
  }

  return supabase
    .from<MessagePaymentReminderRow>('message_payment_reminder')
    .select(MESSAGE_PAYMENT_REMINDER_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageEventRemindersByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageEventReminderRow[] };
  }

  return supabase
    .from<MessageEventReminderRow>('message_event_reminder')
    .select(MESSAGE_EVENT_REMINDER_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageFeedbackRequestsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageFeedbackRequestRow[] };
  }

  return supabase
    .from<MessageFeedbackRequestRow>('message_feedback_request')
    .select(MESSAGE_FEEDBACK_REQUEST_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageLessonAssignmentsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageLessonAssignmentRow[] };
  }

  return supabase
    .from<MessageLessonAssignmentRow>('message_lesson_assignment')
    .select(MESSAGE_LESSON_ASSIGNMENT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageProgressUpdatesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageProgressUpdateRow[] };
  }

  return supabase
    .from<MessageProgressUpdateRow>('message_progress_update')
    .select(MESSAGE_PROGRESS_UPDATE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageSessionBookingsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageSessionBookingRow[] };
  }

  return supabase
    .from<MessageSessionBookingRow>('message_session_booking')
    .select(MESSAGE_SESSION_BOOKING_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageSessionCompletesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageSessionCompleteRow[] };
  }

  return supabase
    .from<MessageSessionCompleteRow>('message_session_complete')
    .select(MESSAGE_SESSION_COMPLETE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageSessionSummariesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageSessionSummaryRow[] };
  }

  return supabase
    .from<MessageSessionSummaryRow>('message_session_summary')
    .select(MESSAGE_SESSION_SUMMARY_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageHomeworkSubmissionsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageHomeworkSubmissionRow[] };
  }

  return supabase
    .from<MessageHomeworkSubmissionRow>('message_homework_submission')
    .select(MESSAGE_HOMEWORK_SUBMISSION_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageLinkPreviewsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageLinkPreviewRow[] };
  }

  return supabase
    .from<MessageLinkPreviewRow>('message_link_preview')
    .select(MESSAGE_LINK_PREVIEW_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getMessageAudioRecordingsByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageAudioRecordingRow[] };
  }

  return supabase
    .from<MessageAudioRecordingRow>('message_audio_recording')
    .select(MESSAGE_AUDIO_RECORDING_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null);
}

export async function getChannelFilesByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as ChannelFileRow[] };
  }

  return supabase
    .from<ChannelFileRow>('channel_files')
    .select(CHANNEL_FILE_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null);
}

export async function getChannelMediaByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as ChannelMediaRow[] };
  }

  return supabase
    .from<ChannelMediaRow>('channel_media')
    .select(CHANNEL_MEDIA_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null);
}
