import type { ISODateTime, UUID } from '../shared/shared';

export type EventOutboxStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'dead_letter'
  | 'canceled';

export type EventPipelineJobKind =
  | 'activity.generate'
  | 'activity.project'
  | 'notification.prepare'
  | 'notification.deliver'
  | 'reminder.reconcile'
  | 'reminder.dispatch';

export type EventPipelineJobStatus =
  | 'pending'
  | 'leased'
  | 'succeeded'
  | 'suppressed'
  | 'failed'
  | 'dead_letter'
  | 'canceled';

export interface EventOutboxRow {
  id: UUID;
  org_id: UUID;
  event_kind: string;
  source_table?: string | null;
  source_id?: UUID | null;
  source_kind?: string | null;
  actor_profile_id?: UUID | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: EventOutboxStatus;
  processed_at?: ISODateTime | null;
  last_error?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface EventPipelineJobRow {
  id: UUID;
  org_id: UUID;
  outbox_id?: UUID | null;
  job_kind: EventPipelineJobKind;
  source_kind?: string | null;
  source_id?: UUID | null;
  dedupe_key: string;
  payload: Record<string, unknown>;
  priority: number;
  status: EventPipelineJobStatus;
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

export interface EventPipelineLogRow {
  id: UUID;
  org_id: UUID;
  job_id?: UUID | null;
  outbox_id?: UUID | null;
  job_kind?: EventPipelineJobKind | null;
  result: 'succeeded' | 'suppressed' | 'retryable_failure' | 'fatal_failure' | 'canceled';
  details: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
