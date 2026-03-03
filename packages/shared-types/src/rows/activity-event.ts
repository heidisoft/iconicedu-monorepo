import type { ISODateTime, UUID } from '../shared/shared';

export interface ActivityEventRow {
  id: UUID;
  org_id: UUID;
  event_type: string;
  occurred_at: ISODateTime;
  source_kind: string;
  actor_profile_id?: UUID | null;
  scope: Record<string, unknown>;
  object_ref?: Record<string, unknown> | null;
  target_ref?: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  audience_rules?: Record<string, unknown>[] | null;
  dedupe_key?: string | null;
  projection_status: string;
  projection_attempts: number;
  last_projection_error?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
