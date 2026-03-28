import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export interface LearningSpaceRow {
  id: UUID;
  org_id: UUID;
  kind: string;
  status: string;
  title: string;
  icon_key?: string | null;
  subject?: string | null;
  description?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  archived_at?: ISODateTime | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface LearningSpaceChannelRow {
  id: UUID;
  org_id: UUID;
  learning_space_id: UUID;
  channel_id: UUID;
  is_primary: boolean;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface LearningSpaceParticipantRow {
  id: UUID;
  org_id: UUID;
  learning_space_id: UUID;
  profile_id: UUID;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
