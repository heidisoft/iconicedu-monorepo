export const CHANNEL_SELECT =
  [
    'id',
    'org_id',
    'kind',
    'topic',
    'icon_key',
    'description',
    'visibility',
    'purpose',
    'status',
    'dm_key',
    'posting_policy_kind',
    'allow_threads',
    'allow_reactions',
    'primary_entity_kind',
    'primary_entity_id',
    'ui_theme_key',
    'created_by_profile_id',
    'created_at',
    'archived_at',
    'created_by',
    'updated_at',
    'updated_by',
    'deleted_at',
    'deleted_by',
  ].join(',');

export const CHANNEL_MEMBER_SELECT =
  'id, org_id, channel_id, profile_id, joined_at, role_in_channel, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by';

export const CHANNEL_CAPABILITY_SELECT =
  'id, org_id, channel_id, capability, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by';

export const CHANNEL_READ_STATE_SELECT =
  'id, org_id, channel_id, account_id, last_read_message_id, last_read_at, unread_count, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by';
