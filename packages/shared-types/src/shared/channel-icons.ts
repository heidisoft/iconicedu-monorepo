import { LEARNING_SPACE_ICON_OPTIONS } from './learning-space-icons';

export const CHANNEL_TOPIC_ICON_KEYS = [
  'sparkles',
  'megaphone',
  'life-buoy',
  'users',
  'message-square',
  'globe',
  'lock',
  'house',
  'briefcase',
  'user-check',
  'book-open',
  'square-pi',
  'languages',
  'chef-hat',
  'earth',
  'chess-knight',
  'palette',
  'paintbrush',
  'scissors',
  'calculator',
  'ruler',
  'pen-tool',
  'notebook-pen',
  'notebook-text',
  'clipboard-check',
  'graduation-cap',
  'landmark',
  'map',
] as const;

export type KnownChannelTopicIconKey = (typeof CHANNEL_TOPIC_ICON_KEYS)[number];

export type ChannelTopicIconOption = {
  value: KnownChannelTopicIconKey;
  label: string;
};

export type ChannelTopicIconGroup = {
  label: string;
  options: readonly ChannelTopicIconOption[];
};

export const DEFAULT_CHANNEL_TOPIC_ICON_KEY: KnownChannelTopicIconKey = 'sparkles';

const GENERAL_CHANNEL_TOPIC_ICON_OPTIONS = [
  { value: 'sparkles', label: 'General' },
  { value: 'megaphone', label: 'Announcements' },
  { value: 'life-buoy', label: 'Support' },
  { value: 'users', label: 'Community group' },
  { value: 'message-square', label: 'Discussion' },
] as const satisfies readonly ChannelTopicIconOption[];

const AUDIENCE_CHANNEL_TOPIC_ICON_OPTIONS = [
  { value: 'globe', label: 'Public channel' },
  { value: 'lock', label: 'Private channel' },
  { value: 'house', label: 'Parent group' },
  { value: 'briefcase', label: 'Staff group' },
  { value: 'user-check', label: 'Mentor group' },
  { value: 'book-open', label: 'Study group' },
] as const satisfies readonly ChannelTopicIconOption[];

const LEARNING_SPACE_CHANNEL_TOPIC_ICON_OPTIONS = LEARNING_SPACE_ICON_OPTIONS.filter(
  (option) => option.value !== 'sparkles',
) as readonly ChannelTopicIconOption[];

export const CHANNEL_TOPIC_ICON_GROUPS = [
  {
    label: 'General channels',
    options: GENERAL_CHANNEL_TOPIC_ICON_OPTIONS,
  },
  {
    label: 'Audience and access',
    options: AUDIENCE_CHANNEL_TOPIC_ICON_OPTIONS,
  },
  {
    label: 'Learning spaces',
    options: LEARNING_SPACE_CHANNEL_TOPIC_ICON_OPTIONS,
  },
] as const satisfies readonly ChannelTopicIconGroup[];

export const CHANNEL_TOPIC_ICON_OPTIONS = CHANNEL_TOPIC_ICON_GROUPS.flatMap(
  (group) => group.options,
);

export function isKnownChannelTopicIconKey(
  value: string,
): value is KnownChannelTopicIconKey {
  return (CHANNEL_TOPIC_ICON_KEYS as readonly string[]).includes(value);
}
