import type { ISODateTime, UUID } from '../shared/shared';

export interface MessageRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  sender_profile_id: UUID;
  type: string;
  created_at: ISODateTime;
  visibility_type: string;
  visibility_user_id?: UUID | null;
  visibility_user_ids?: UUID[] | null;
  is_edited?: boolean | null;
  edited_at?: ISODateTime | null;
  is_saved?: boolean | null;
  is_hidden?: boolean | null;
  thread_id?: UUID | null;
  thread_parent_id?: UUID | null;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageSaveRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  channel_id: UUID;
  profile_id: UUID;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ThreadRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  parent_message_id: UUID;
  snippet?: string | null;
  author_id?: UUID | null;
  author_name?: string | null;
  message_count?: number | null;
  last_reply_at?: ISODateTime | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ThreadParticipantRow {
  id: UUID;
  org_id: UUID;
  thread_id: UUID;
  profile_id: UUID;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ThreadReadStateRow {
  id: UUID;
  org_id: UUID;
  thread_id: UUID;
  channel_id?: UUID | null;
  account_id: UUID;
  last_read_message_id?: UUID | null;
  last_read_at?: ISODateTime | null;
  unread_count?: number | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageTextRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageImageRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageFileRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageDesignFileUpdateRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessagePaymentReminderRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageEventReminderRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageFeedbackRequestRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageLessonAssignmentRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageProgressUpdateRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageSessionBookingRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageSessionCompleteRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageSessionSummaryRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageHomeworkSubmissionRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageLinkPreviewRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageAudioRecordingRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageLiveSessionStartedRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageReactionRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  emoji: string;
  account_id: UUID;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessageReactionCountRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  emoji: string;
  count: number;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelFileRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  message_id?: UUID | null;
  sender_profile_id?: UUID | null;
  kind: string;
  url: string;
  name: string;
  mime_type?: string | null;
  size?: number | null;
  tool?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelMediaRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  message_id?: UUID | null;
  sender_profile_id?: UUID | null;
  type: string;
  url: string;
  name?: string | null;
  width?: number | null;
  height?: number | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
