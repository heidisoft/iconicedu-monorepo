export const LEARNING_SPACE_SELECT = [
  'id',
  'org_id',
  'kind',
  'status',
  'title',
  'icon_key',
  'subject',
  'description',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'archived_at',
  'deleted_at',
  'deleted_by',
].join(',');

export const LEARNING_SPACE_CHANNEL_SELECT = [
  'id',
  'org_id',
  'learning_space_id',
  'channel_id',
  'is_primary',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const LEARNING_SPACE_PARTICIPANT_SELECT = [
  'id',
  'org_id',
  'learning_space_id',
  'profile_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');
