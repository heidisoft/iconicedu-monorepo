import type { ISODateTime, UUID } from '../shared/shared';

export type ActivitySourceJobKind =
  | 'message'
  | 'reaction'
  | 'session_cancel'
  | 'session_reschedule';

export interface ActivitySourceJobRow {
  id: UUID;
  org_id: UUID;
  job_kind: ActivitySourceJobKind;
  message_id?: UUID | null;
  reaction_id?: UUID | null;
  exception_id?: UUID | null;
  override_id?: UUID | null;
  dedupe_key: string;
  status: 'pending' | 'leased' | 'succeeded' | 'failed' | 'dead_letter' | 'canceled';
  attempt_count: number;
  max_attempts: number;
  run_at: ISODateTime;
  lease_owner?: string | null;
  lease_until?: ISODateTime | null;
  next_attempt_at?: ISODateTime | null;
  last_error?: string | null;
  dispatched_at?: ISODateTime | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
