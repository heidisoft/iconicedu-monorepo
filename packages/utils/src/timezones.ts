import {
  getAllTimezones,
  getCountryForTimezone,
  getTimezonesForCountry,
} from 'countries-and-timezones';

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

function toWords(value: string) {
  return value.replace(/[_-]+/g, ' ').trim();
}

export function getTimezoneDisplayLabel(timezone?: string | null) {
  const value = timezone?.trim();
  if (!value) {
    return `${DEFAULT_TIMEZONE} time`;
  }

  const segments = value.split('/');
  const cityOrRegion = segments.length > 0 ? segments[segments.length - 1] : value;
  const normalized = toWords(cityOrRegion);
  if (!normalized) {
    return `${DEFAULT_TIMEZONE} time`;
  }

  const country = getCountryForTimezone(value);
  if (!country) {
    return `${normalized} time`;
  }

  const countryName = country.name.trim();
  if (!countryName) {
    return `${normalized} time`;
  }

  const countryTimezones = getTimezonesForCountry(country.id) ?? [];
  if (countryTimezones.length === 1) {
    return `${countryName} time`;
  }

  return `${normalized} time`;
}
