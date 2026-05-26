export type LocalTimeIconKey =
  | 'clock'
  | 'morning'
  | 'day'
  | 'evening'
  | 'off-hours'
  | 'offline';

export type LocalTimePresenceStatus =
  | 'online'
  | 'busy'
  | 'idle'
  | 'away'
  | 'offline'
  | null;

export type LocalTimeContext = {
  icon: LocalTimeIconKey;
  descriptor: string | null;
  tooltipLabel: string | null;
};

const COUNTRY_LABELS: Record<string, string> = {
  LK: 'Sri Lanka',
  IN: 'India',
  AU: 'Australia',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  NZ: 'New Zealand',
  SG: 'Singapore',
  AE: 'UAE',
  SA: 'Saudi Arabia',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  MY: 'Malaysia',
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  FR: 'France',
  DE: 'Germany',
  TR: 'Turkey',
  BR: 'Brazil',
  JP: 'Japan',
  CN: 'China',
  PH: 'Philippines',
  OM: 'Oman',
  QA: 'Qatar',
};

export function formatLocalTimeText(timezone?: string | null): string | null {
  const value = timezone?.trim();
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: value,
    }).format(new Date());
  } catch {
    return null;
  }
}

export function resolveLocalTimeIconKey(input: {
  timezone?: string | null;
  presenceStatus?: LocalTimePresenceStatus;
}): LocalTimeIconKey {
  if (input.presenceStatus === 'offline') return 'offline';

  const value = input.timezone?.trim();
  if (!value) return 'clock';

  try {
    const hourText = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: value,
    }).format(new Date());
    const hour = Number.parseInt(hourText, 10);
    if (!Number.isFinite(hour)) return 'clock';
    if (hour >= 5 && hour < 9) return 'morning';
    if (hour >= 9 && hour < 18) return 'day';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'off-hours';
  } catch {
    return 'clock';
  }
}

export function buildLocalTimeContext(input: {
  timezone?: string | null;
  city?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  presenceStatus?: LocalTimePresenceStatus;
}): LocalTimeContext | null {
  const timeText = formatLocalTimeText(input.timezone);
  if (!timeText) return null;

  const icon = resolveLocalTimeIconKey({
    timezone: input.timezone,
    presenceStatus: input.presenceStatus,
  });

  const normalizedCity = input.city?.trim() ?? '';
  const normalizedCountryName = input.countryName?.trim() ?? '';
  const normalizedCountryCode = input.countryCode?.trim().toUpperCase() ?? '';
  const normalizedCountry =
    normalizedCountryName ||
    (normalizedCountryCode ? (COUNTRY_LABELS[normalizedCountryCode] ?? '') : '');
  const locationLabel =
    normalizedCity && normalizedCountry
      ? `${normalizedCity}, ${normalizedCountry}`
      : normalizedCity || normalizedCountry || null;

  const descriptor =
    icon === 'offline'
      ? 'They may be offline right now'
      : icon === 'morning'
        ? 'It is morning there'
        : icon === 'day'
          ? 'It is daytime there'
          : icon === 'evening'
            ? 'It is evening there'
            : icon === 'off-hours'
              ? 'It may be off hours there'
              : null;

  const tooltipLines = [`Current time: ${timeText}`];
  if (locationLabel) {
    tooltipLines.push(`Location: ${locationLabel}`);
  }
  if (descriptor) {
    tooltipLines.push(descriptor);
  }

  return {
    icon,
    descriptor,
    tooltipLabel: tooltipLines.join('\n'),
  };
}
