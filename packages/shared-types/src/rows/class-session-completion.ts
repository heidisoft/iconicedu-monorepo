import type { ISODateTime, UUID } from '../shared/shared';
import type { ParticipantRoleVM } from '../vm/class-schedule';

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
  role: ParticipantRoleVM;
  status: ClassSessionCompletionStatus;
  dispute_category?: ClassSessionCompletionDisputeCategory | null;
  dispute_reason?: string | null;
  reschedule_requested: boolean;
  rating?: number | null;
  rating_comment?: string | null;
  channel_id?: UUID | null;
  learning_space_id?: UUID | null;
  session_title?: string | null;
  // Comma-joined name(s) of the OTHER participant(s) relevant to this row's
  // viewer — mirrors the homepage's "Upcoming Sessions" tile
  // (getViewerParticipantNames): an educator's row shows the student(s); a
  // child's row shows their educator(s); a guardian's row shows their own
  // linked child(ren) (never other families' children in a group class) plus
  // the educator(s); staff/observer rows show the full roster.
  student_name?: string | null;
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
