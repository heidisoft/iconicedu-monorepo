import type { ISODateTime, UUID } from '../shared/shared';

export type NotificationDispatchJobStatus =
  | 'pending'
  | 'leased'
  | 'succeeded'
  | 'suppressed'
  | 'failed'
  | 'dead_letter';

export interface NotificationDispatchJobRow {
  id: UUID;
  org_id: UUID;
  activity_event_id: UUID;
  recipient_profile_id: UUID;
  pref_key: string;
  scope_kind?: 'channel' | 'learning_space' | null;
  scope_id?: UUID | null;
  delivery_channel: 'push' | 'email' | 'sms';
  delivery_timing: 'immediate' | 'delayed' | 'digest';
  attempt_bucket: string;
  run_at: ISODateTime;
  payload: Record<string, unknown>;
  status: NotificationDispatchJobStatus;
  attempt_count: number;
  max_attempts: number;
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

export interface NotificationDispatchLogRow {
  id: UUID;
  org_id: UUID;
  notification_dispatch_job_id: UUID;
  result: 'succeeded' | 'suppressed' | 'retryable_failure' | 'fatal_failure';
  details: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
