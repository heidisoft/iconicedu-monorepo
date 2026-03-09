import type { ISODateTime, UUID } from '../shared/shared';

export interface ActivityEventSuppressionRuleRow {
  id: UUID;
  org_id: UUID;
  event_type: string;
  actor_profile_id?: UUID | null;
  is_enabled: boolean;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
