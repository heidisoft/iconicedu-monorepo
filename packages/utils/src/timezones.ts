import { getAllTimezones } from 'countries-and-timezones';

export type TimezoneOption = {
  name: string;
  countryCode: string | null;
  label: string;
};

export const DEFAULT_TIMEZONE = 'UTC';

let cachedTimezoneOptions: TimezoneOption[] | null = null;

export function countryCodeToEmoji(code?: string | null) {
  if (!code) {
    return null;
  }

  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
}

export function normalizeTimezone(value?: string | null) {
  const next = value?.trim() ?? '';
  return next === DEFAULT_TIMEZONE ? '' : next;
}

export function getTimezoneOptions(): TimezoneOption[] {
  if (cachedTimezoneOptions) {
    return cachedTimezoneOptions;
  }

  const options = Object.values(getAllTimezones()).reduce<TimezoneOption[]>(
    (acc, timezone) => {
      if (!timezone.name) {
        return acc;
      }

      acc.push({
        name: timezone.name,
        countryCode: timezone.countries?.[0] ?? null,
        label: timezone.name,
      });
      return acc;
    },
    [],
  );

  cachedTimezoneOptions = options.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  return cachedTimezoneOptions;
}

export function getBrowserTimezone() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return null;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
}
