import type { ISODateTime, UUID } from '../shared/shared';

export interface ChannelRow {
  id: UUID;
  org_id: UUID;
  kind: string;
  topic: string;
  icon_key?: string | null;
  description?: string | null;
  visibility: string;
  purpose: string;
  status: string;
  dm_key?: string | null;
  posting_policy_kind?: string | null;
  allow_threads?: boolean | null;
  allow_reactions?: boolean | null;
  primary_entity_kind?: string | null;
  primary_entity_id?: UUID | null;
  ui_theme_key?: string | null;
  created_by_profile_id?: UUID | null;
  created_at: ISODateTime;
  archived_at?: ISODateTime | null;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelMemberRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  profile_id: UUID;
  joined_at: ISODateTime;
  role_in_channel?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelCapabilityRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  capability: string;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelReadStateRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  account_id: UUID;
  last_read_message_id?: UUID | null;
  last_read_at?: ISODateTime | null;
  unread_count?: number | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
