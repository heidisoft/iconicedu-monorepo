import type { ISODateTime, UUID } from '../shared/shared';

export type ClassSessionCompletionStatus =
  | 'pending'
  | 'confirmed'
  | 'disputed'
  | 'auto_confirmed';

export type ClassSessionCompletionDisputeCategory =
  | 'teacher_absent'
  | 'student_absent'
  | 'technical_issue'
  | 'other';

export interface ClassSessionCompletionRow {
  id: UUID;
  org_id: UUID;
  schedule_id: UUID;
  occurrence_key: ISODateTime;
  profile_id: UUID;
  role: string;
  status: ClassSessionCompletionStatus;
  dispute_category?: ClassSessionCompletionDisputeCategory | null;
  dispute_reason?: string | null;
  reschedule_requested: boolean;
  rating?: number | null;
  rating_comment?: string | null;
  channel_id?: UUID | null;
  learning_space_id?: UUID | null;
  session_title?: string | null;
  session_end_at: ISODateTime;
  notified_at?: ISODateTime | null;
  confirmed_at?: ISODateTime | null;
  disputed_at?: ISODateTime | null;
  rated_at?: ISODateTime | null;
  resolved_at?: ISODateTime | null;
  expires_at: ISODateTime;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
