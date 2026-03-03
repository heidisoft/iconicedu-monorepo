import type { ISODateTime, UUID } from '../shared/shared';

export interface ActivityFeedItemRow {
  id: UUID;
  org_id: UUID;
  recipient_profile_id: UUID;
  source_event_id?: UUID | null;
  kind: string;
  occurred_at: ISODateTime;
  created_at: ISODateTime;
  tab_key: string;
  audience: Record<string, unknown>;
  verb: string;
  actor_profile_id?: UUID | null;
  refs?: Record<string, unknown> | null;
  group_key?: string | null;
  group_type?: string | null;
  is_collapsed?: boolean | null;
  sub_activity_count?: number | null;
  content: Record<string, unknown>;
  summary?: string | null;
  preview?: Record<string, unknown> | null;
  action_button?: Record<string, unknown> | null;
  expanded_content?: string | null;
  importance?: string | null;
  is_read?: boolean | null;
  read_at?: ISODateTime | null;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ActivityFeedSectionRow {
  id: UUID;
  org_id: UUID;
  label: string;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ActivityFeedGroupMemberRow {
  id: UUID;
  org_id: UUID;
  group_id: UUID;
  item_id: UUID;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
