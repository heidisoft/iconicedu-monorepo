export {
  type AnalyticsClient,
  type AnalyticsEventName,
  type UserTraits,
  type ScreenViewedProps,
  type ButtonClickedProps,
  type FormEventProps,
  type SearchProps,
  type MessageEventProps,
  type ErrorEventProps,
  type FunnelProps,
  type NotificationEventProps,
  AnalyticsEvent,
  createNoopAnalytics,
} from './analytics';

export {
  type ErrorReporter,
  type ObservedErrorInput,
  buildObservedErrorProperties,
  normalizeObservedError,
  reportObservedError,
  setGlobalErrorReporter,
} from './error-monitoring';

export {
  type DateStylePreset,
  type DateTimeStylePreset,
  type TimeStylePreset,
  formatDateTime,
  formatDate,
  formatTime,
  formatDateInTimezone,
  formatTimeInTimezone,
  resolveViewerTimezone,
  toZonedDateTime,
  toUtcFromLocal,
  isOvernight,
  buildOccurrenceKey,
  getLocalDateParts,
  getLocalDate,
  getLocalTime,
  isValidTimezone,
} from './time';

export {
  type TimezoneOption,
  DEFAULT_TIMEZONE,
  getTimezoneDisplayLabel,
  getTimezoneOptions,
  getBrowserTimezone,
  normalizeTimezone,
  countryCodeToEmoji,
} from './timezones';

export function groupBy<T, K extends string>(
  rows: T[],
  getKey: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}

export function createEnumNormalizer<T extends string>(allowedValues: readonly T[]) {
  return (raw: string | null | undefined): T | null => {
    if (raw != null && (allowedValues as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return null;
  };
}
