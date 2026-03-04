import type { ISODateTime, UUID } from '../shared/shared';
import type { AuditRow, MessagePayloadRow } from './base';

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

export interface MessageSaveRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  channel_id: UUID;
  profile_id: UUID;
}

export interface ThreadRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  parent_message_id: UUID;
  snippet?: string | null;
  author_id?: UUID | null;
  author_name?: string | null;
  message_count?: number | null;
  last_reply_at?: ISODateTime | null;
}

export interface ThreadParticipantRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  thread_id: UUID;
  profile_id: UUID;
}

export interface ThreadReadStateRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  thread_id: UUID;
  channel_id?: UUID | null;
  account_id: UUID;
  last_read_message_id?: UUID | null;
  last_read_at?: ISODateTime | null;
  unread_count?: number | null;
}

export type MessageTextRow = MessagePayloadRow;
export type MessageImageRow = MessagePayloadRow;
export type MessageFileRow = MessagePayloadRow;
export type MessageDesignFileUpdateRow = MessagePayloadRow;
export type MessagePaymentReminderRow = MessagePayloadRow;
export type MessageEventReminderRow = MessagePayloadRow;
export type MessageFeedbackRequestRow = MessagePayloadRow;
export type MessageLessonAssignmentRow = MessagePayloadRow;
export type MessageProgressUpdateRow = MessagePayloadRow;
export type MessageSessionBookingRow = MessagePayloadRow;
export type MessageSessionCompleteRow = MessagePayloadRow;
export type MessageSessionSummaryRow = MessagePayloadRow;
export type MessageHomeworkSubmissionRow = MessagePayloadRow;
export type MessageLinkPreviewRow = MessagePayloadRow;
export type MessageAudioRecordingRow = MessagePayloadRow;
export type MessageLiveSessionStartedRow = MessagePayloadRow;

export interface MessageReactionRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  emoji: string;
  account_id: UUID;
}

export interface MessageReactionCountRow extends AuditRow {
  id: UUID;
  org_id: UUID;
  message_id: UUID;
  emoji: string;
  count: number;
}

export interface ChannelFileRow extends AuditRow {
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
}

export interface ChannelMediaRow extends AuditRow {
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
}
