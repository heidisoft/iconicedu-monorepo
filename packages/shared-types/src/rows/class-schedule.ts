import type { ISODateTime, UUID } from '../shared/shared';

export interface ClassScheduleRow {
  id: UUID;
  org_id: UUID;
  title: string;
  description?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  start_at: ISODateTime;
  end_at: ISODateTime;
  timezone?: string | null;
  status: string;
  visibility: string;
  theme_key?: string | null;
  source_kind: string;
  source_learning_space_id?: UUID | null;
  source_channel_id?: UUID | null;
  source_session_id?: UUID | null;
  source_owner_user_id?: UUID | null;
  source_created_by_user_id?: UUID | null;
  source_related_learning_space_id?: UUID | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
  source_learning_space?: {
    status?: string | null;
    archived_at?: ISODateTime | null;
  } | null;
}

export interface ClassScheduleParticipantRow {
  id: UUID;
  org_id: UUID;
  schedule_id: UUID;
  profile_id: UUID;
  role: string;
  status?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  theme_key?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ClassScheduleRecurrenceRow {
  id: UUID;
  org_id: UUID;
  schedule_id: UUID;
  frequency: string;
  interval?: number | null;
  raw_rrule?: string | null;
  bysecond?: number[] | null;
  byminute?: number[] | null;
  byhour?: number[] | null;
  byday?: string[] | null;
  bymonthday?: number[] | null;
  byyearday?: number[] | null;
  byweekno?: number[] | null;
  bymonth?: number[] | null;
  bysetpos?: number[] | null;
  wkst?: string | null;
  count?: number | null;
  until?: ISODateTime | null;
  timezone?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ClassScheduleRecurrenceExceptionRow {
  id: UUID;
  org_id: UUID;
  recurrence_id: UUID;
  occurrence_key: ISODateTime;
  reason?: string | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}

export interface ClassScheduleRecurrenceOverrideRow {
  id: UUID;
  org_id: UUID;
  recurrence_id: UUID;
  occurrence_key: ISODateTime;
  patch: Record<string, unknown>;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
