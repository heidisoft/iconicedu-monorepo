export type StatusClearAfterOption = 'never' | '30m' | '1h' | '4h' | 'today' | 'week';

export const STATUS_EMOJI_OPTIONS = ['🏠', '📅', '🚌', '🤒', '✈️', '📚', '☕', '🧠'] as const;

export const STATUS_CLEAR_AFTER_OPTIONS: Array<{ value: StatusClearAfterOption; label: string }> = [
  { value: 'never', label: "Don't clear" },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
];

export const STATUS_PRESETS: Array<{
  label: string;
  emoji: string;
  text: string;
  clearAfter: StatusClearAfterOption;
}> = [
  { label: 'In a meeting', emoji: '📅', text: 'In a meeting', clearAfter: '1h' },
  { label: 'Commuting', emoji: '🚌', text: 'Commuting', clearAfter: '30m' },
  { label: 'Out of office', emoji: '✈️', text: 'Out of office', clearAfter: 'today' },
  { label: 'Working remotely', emoji: '🏠', text: 'Working remotely', clearAfter: 'today' },
];

export const computeStatusExpiresAt = (
  option: StatusClearAfterOption,
  now = new Date(),
): string | null => {
  const date = new Date(now.getTime());
  if (option === 'never') {
    return null;
  }
  if (option === '30m') {
    date.setMinutes(date.getMinutes() + 30);
    return date.toISOString();
  }
  if (option === '1h') {
    date.setHours(date.getHours() + 1);
    return date.toISOString();
  }
  if (option === '4h') {
    date.setHours(date.getHours() + 4);
    return date.toISOString();
  }
  if (option === 'today') {
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
  }
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7 || 7));
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
};
