export const MESSAGE_SELECT = [
  'id',
  'org_id',
  'channel_id',
  'sender_profile_id',
  'type',
  'created_at',
  'visibility_type',
  'visibility_user_id',
  'visibility_user_ids',
  'is_edited',
  'edited_at',
  'is_saved',
  'is_hidden',
  'thread_id',
  'thread_parent_id',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const THREAD_SELECT = [
  'id',
  'org_id',
  'channel_id',
  'parent_message_id',
  'snippet',
  'author_id',
  'author_name',
  'message_count',
  'last_reply_at',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const THREAD_PARTICIPANT_SELECT = [
  'id',
  'org_id',
  'thread_id',
  'profile_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const MESSAGE_REACTION_SELECT = [
  'id',
  'org_id',
  'message_id',
  'emoji',
  'account_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const MESSAGE_REACTION_COUNT_SELECT = [
  'id',
  'org_id',
  'message_id',
  'emoji',
  'count',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const MESSAGE_SAVE_SELECT = [
  'id',
  'org_id',
  'message_id',
  'channel_id',
  'profile_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

const MESSAGE_PAYLOAD_BASE_SELECT = [
  'message_id',
  'org_id',
  'payload',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const MESSAGE_TEXT_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_IMAGE_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_FILE_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_DESIGN_FILE_UPDATE_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_PAYMENT_REMINDER_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_EVENT_REMINDER_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_FEEDBACK_REQUEST_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_LESSON_ASSIGNMENT_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_PROGRESS_UPDATE_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_SESSION_BOOKING_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_SESSION_COMPLETE_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_SESSION_SUMMARY_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_HOMEWORK_SUBMISSION_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_LINK_PREVIEW_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_AUDIO_RECORDING_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;
export const MESSAGE_LIVE_SESSION_STARTED_SELECT = MESSAGE_PAYLOAD_BASE_SELECT;

export const CHANNEL_FILE_SELECT = [
  'id',
  'org_id',
  'channel_id',
  'message_id',
  'sender_profile_id',
  'kind',
  'url',
  'name',
  'mime_type',
  'size',
  'tool',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');

export const CHANNEL_MEDIA_SELECT = [
  'id',
  'org_id',
  'channel_id',
  'message_id',
  'sender_profile_id',
  'type',
  'url',
  'name',
  'width',
  'height',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(',');
