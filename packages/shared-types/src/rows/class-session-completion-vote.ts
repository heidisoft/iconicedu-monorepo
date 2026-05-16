import type { ISODateTime, UUID } from '../shared/shared';

export interface ClassSessionCompletionVoteRow {
  id: UUID;
  org_id: UUID;
  schedule_id: UUID;
  occurrence_key: ISODateTime;
  profile_id: UUID;
  role: string;
  status: 'confirmed' | 'disputed';
  dispute_category?: string | null;
  dispute_reason?: string | null;
  reschedule_requested: boolean;
  voted_at: ISODateTime;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
