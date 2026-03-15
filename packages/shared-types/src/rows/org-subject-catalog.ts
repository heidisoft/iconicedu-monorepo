import type { ISODateTime, UUID } from '../shared/shared';

export interface OrgSubjectCatalogRow {
  id: UUID;
  org_id: UUID;
  subject: string;
  subject_key: string;
  is_active: boolean;
  sort_order: number;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
