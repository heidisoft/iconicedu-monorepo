import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MessageRow,
  ThreadRow,
  MessageReactionRow,
  MessageReactionCountRow,
  MessageSaveRow,
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
  MessageLiveSessionStartedRow,
} from '@iconicedu/shared-types';

import {
  MESSAGE_SELECT,
  THREAD_SELECT,
  THREAD_PARTICIPANT_SELECT,
  THREAD_READ_STATE_SELECT,
  MESSAGE_REACTION_SELECT,
  MESSAGE_REACTION_COUNT_SELECT,
  MESSAGE_SAVE_SELECT,
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
  MESSAGE_LIVE_SESSION_STARTED_SELECT,
  CHANNEL_FILE_SELECT,
  CHANNEL_MEDIA_SELECT,
} from '@iconicedu/web/lib/messages/constants/selects';

export async function getMessagesByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<MessageRow[]>();
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
    .from('messages')
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
  const rows = (response.data ?? []) as unknown as MessageRow[];
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
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .eq('id', messageId)
    .is('deleted_at', null)
    .maybeSingle<MessageRow>();
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
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<MessageRow[]>();
}

export async function getMessagesByThreadId(
  supabase: SupabaseClient,
  orgId: string,
  threadId: string,
  options: { parentMessageId?: string | null } = {},
) {
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (options.parentMessageId) {
    query = query.or(
      `thread_id.eq.${threadId},thread_parent_id.eq.${options.parentMessageId}`,
    );
  } else {
    query = query.eq('thread_id', threadId);
  }

  return query.returns<MessageRow[]>();
}

export async function getThreadsByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from('threads')
    .select(THREAD_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .returns<ThreadRow[]>();
}

export async function getThreadById(
  supabase: SupabaseClient,
  orgId: string,
  threadId: string,
) {
  return supabase
    .from('threads')
    .select(THREAD_SELECT)
    .eq('org_id', orgId)
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle<ThreadRow>();
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
    .from('thread_participants')
    .select(THREAD_PARTICIPANT_SELECT)
    .eq('org_id', orgId)
    .in('thread_id', threadIds)
    .is('deleted_at', null)
    .returns<ThreadParticipantRow[]>();
}

export async function getThreadReadStatesByAccountId(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
) {
  return supabase
    .from('thread_read_state')
    .select(THREAD_READ_STATE_SELECT)
    .eq('org_id', orgId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .returns<ThreadReadStateRow[]>();
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
    .from('message_reactions')
    .select(MESSAGE_REACTION_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageReactionRow[]>();
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
    .from('message_reaction_counts')
    .select(MESSAGE_REACTION_COUNT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageReactionCountRow[]>();
}

export async function getMessageSavesByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageSaveRow[] };
  }

  return supabase
    .from('message_saves')
    .select(MESSAGE_SAVE_SELECT)
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageSaveRow[]>();
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
    .from('message_text')
    .select(MESSAGE_TEXT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageTextRow[]>();
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
    .from('message_image')
    .select(MESSAGE_IMAGE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageImageRow[]>();
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
    .from('message_file')
    .select(MESSAGE_FILE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageFileRow[]>();
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
    .from('message_design_file_update')
    .select(MESSAGE_DESIGN_FILE_UPDATE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageDesignFileUpdateRow[]>();
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
    .from('message_payment_reminder')
    .select(MESSAGE_PAYMENT_REMINDER_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessagePaymentReminderRow[]>();
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
    .from('message_event_reminder')
    .select(MESSAGE_EVENT_REMINDER_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageEventReminderRow[]>();
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
    .from('message_feedback_request')
    .select(MESSAGE_FEEDBACK_REQUEST_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageFeedbackRequestRow[]>();
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
    .from('message_lesson_assignment')
    .select(MESSAGE_LESSON_ASSIGNMENT_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageLessonAssignmentRow[]>();
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
    .from('message_progress_update')
    .select(MESSAGE_PROGRESS_UPDATE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageProgressUpdateRow[]>();
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
    .from('message_session_booking')
    .select(MESSAGE_SESSION_BOOKING_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageSessionBookingRow[]>();
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
    .from('message_session_complete')
    .select(MESSAGE_SESSION_COMPLETE_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageSessionCompleteRow[]>();
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
    .from('message_session_summary')
    .select(MESSAGE_SESSION_SUMMARY_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageSessionSummaryRow[]>();
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
    .from('message_homework_submission')
    .select(MESSAGE_HOMEWORK_SUBMISSION_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageHomeworkSubmissionRow[]>();
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
    .from('message_link_preview')
    .select(MESSAGE_LINK_PREVIEW_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageLinkPreviewRow[]>();
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
    .from('message_audio_recording')
    .select(MESSAGE_AUDIO_RECORDING_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageAudioRecordingRow[]>();
}

export async function getMessageLiveSessionStartedByMessageIds(
  supabase: SupabaseClient,
  orgId: string,
  messageIds: string[],
) {
  if (!messageIds.length) {
    return { data: [] as MessageLiveSessionStartedRow[] };
  }

  return supabase
    .from('message_live_session_started')
    .select(MESSAGE_LIVE_SESSION_STARTED_SELECT)
    .eq('org_id', orgId)
    .in('message_id', messageIds)
    .is('deleted_at', null)
    .returns<MessageLiveSessionStartedRow[]>();
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
    .from('channel_files')
    .select(CHANNEL_FILE_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .returns<ChannelFileRow[]>();
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
    .from('channel_media')
    .select(CHANNEL_MEDIA_SELECT)
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .returns<ChannelMediaRow[]>();
}
