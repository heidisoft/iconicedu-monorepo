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
  live_session_config?: Record<string, unknown> | null;
  ui_theme_key?: string | null;
  ui_defaults?: Record<string, unknown> | null;
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

export interface ChannelLiveSessionRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  provider: string;
  provider_session_id?: string | null;
  session_scope_key: string;
  occurrence_key?: ISODateTime | null;
  status: string;
  started_by_profile_id: UUID;
  started_message_id?: UUID | null;
  join_path: string;
  started_at: ISODateTime;
  ended_at?: ISODateTime | null;
  failed_at?: ISODateTime | null;
  failure_reason?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelLiveSessionParticipantRow {
  id: UUID;
  org_id: UUID;
  live_session_id: UUID;
  channel_id: UUID;
  profile_id: UUID;
  join_requested_at?: ISODateTime | null;
  first_joined_at?: ISODateTime | null;
  last_joined_at?: ISODateTime | null;
  last_left_at?: ISODateTime | null;
  join_count?: number | null;
  total_seconds?: number | null;
  last_known_status?: string | null;
  provider_participant_id?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ChannelLiveSessionParticipantEventRow {
  id: UUID;
  org_id: UUID;
  live_session_id: UUID;
  channel_id: UUID;
  profile_id?: UUID | null;
  provider_participant_id?: string | null;
  provider: string;
  event_type: string;
  occurred_at: ISODateTime;
  source: string;
  provider_event_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
