import type { ISODateTime, UUID } from '../shared/shared';

export interface ClassSessionFeedbackRow {
  id: UUID;
  org_id: UUID;
  recipient_profile_id: UUID;
  class_session_id: UUID;
  classroom_id: UUID;
  channel_id: UUID;
  message_id?: UUID | null;
  source_event_id?: UUID | null;
  occurrence_start_at?: ISODateTime | null;
  rating: number;
  comment?: string | null;
  submitted_at: ISODateTime;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
