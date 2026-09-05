import type { ISODateTime, UUID } from '../shared/shared';

export interface ReminderJobRow {
  id: UUID;
  org_id: UUID;
  job_type: 'session.reminder' | 'session.feedback_request' | 'session.completion_check';
  target_kind: 'channel' | 'dm' | 'user_scope';
  target_id: UUID;
  source_learning_space_id?: UUID | null;
  source_schedule_id?: UUID | null;
  source_invoice_id?: string | null;
  occurrence_start_at?: ISODateTime | null;
  run_at: ISODateTime;
  timezone?: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: 'pending' | 'leased' | 'succeeded' | 'failed' | 'dead_letter' | 'canceled';
  attempt_count: number;
  max_attempts: number;
  lease_owner?: string | null;
  lease_until?: ISODateTime | null;
  next_attempt_at?: ISODateTime | null;
  last_error?: string | null;
  dispatched_at?: ISODateTime | null;
  completion_reconciled_at?: ISODateTime | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ReminderDispatchLogRow {
  id: UUID;
  org_id: UUID;
  reminder_job_id: UUID;
  message_id?: UUID | null;
  activity_event_id?: UUID | null;
  result: 'succeeded' | 'idempotent_hit' | 'retryable_failure' | 'fatal_failure';
  details: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
