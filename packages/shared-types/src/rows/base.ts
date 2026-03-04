import type { ISODateTime, UUID } from '../shared/shared';

export interface AuditRow {
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface MessagePayloadRow extends AuditRow {
  message_id: UUID;
  org_id: UUID;
  payload: Record<string, unknown>;
}
