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

/**
 * Profile fields selected alongside a message for lightweight sender previews.
 * This intentionally models the query projection, not the complete profiles row.
 */
export type RawSenderProfile = {
  id: UUID;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  kind?: string | null;
  timezone?: string | null;
  ui_theme_key?: string | null;
};

/** Raw messages query result consumed by the framework-neutral row-to-VM utility. */
export type RawMessageRow = Pick<
  MessageRow,
  | 'id'
  | 'org_id'
  | 'channel_id'
  | 'sender_profile_id'
  | 'type'
  | 'created_at'
  | 'updated_at'
  | 'thread_parent_id'
> & {
  visibility_type?: 'all' | 'specific-users' | null;
  visibility_user_ids?: UUID[] | null;
  sender: RawSenderProfile | null;
};

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
