import { BadRequestException } from '@nestjs/common';
import { parseGradeLevel } from '@iconicedu/shared-types';
import type { ProfileSettingsInput } from '@iconicedu/shared-types';
import { normalizeProfileLocation } from './profile-location';

export function normalizeProfileSettings(body: ProfileSettingsInput) {
  if (!body || typeof body !== 'object')
    throw new BadRequestException('Invalid profile.');
  const values: Record<string, unknown> = {};
  for (const [key, column] of [
    ['firstName', 'first_name'],
    ['lastName', 'last_name'],
    ['displayName', 'display_name'],
  ] as const) {
    if (
      typeof body[key] !== 'string' ||
      !body[key].trim() ||
      body[key].trim().length > 100
    ) {
      throw new BadRequestException(`${key} must contain 1–100 characters.`);
    }
    values[column] = body[key].trim();
  }
  const themes = [
    'slate',
    'gray',
    'zinc',
    'neutral',
    'stone',
    'amber',
    'blue',
    'cyan',
    'emerald',
    'fuchsia',
    'green',
    'indigo',
    'lime',
    'orange',
    'pink',
    'purple',
    'red',
    'rose',
    'sky',
    'teal',
    'violet',
    'yellow',
  ];
  if (!themes.includes(body.themeKey))
    throw new BadRequestException('Choose a valid accent color.');
  try {
    if (typeof body.timezone !== 'string' || !body.timezone || body.timezone.length > 100)
      throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: body.timezone });
    if (typeof body.locale !== 'string' || !body.locale || body.locale.length > 35)
      throw new Error();
    if (!Intl.DateTimeFormat.supportedLocalesOf([body.locale]).length) throw new Error();
  } catch {
    throw new BadRequestException('Choose a valid timezone and language/region code.');
  }
  if (typeof body.hideRole !== 'boolean' || typeof body.hideStatus !== 'boolean')
    throw new BadRequestException('Invalid visibility preferences.');
  Object.assign(values, {
    ui_theme_key: body.themeKey,
    timezone: body.timezone,
    locale: body.locale,
    hide_role: body.hideRole,
    hide_status: body.hideStatus,
  });
  if (body.location !== undefined) {
    if (
      !body.location ||
      typeof body.location.countryCode !== 'string' ||
      ['city', 'region', 'postalCode'].some((key) => {
        const value = body.location?.[key as 'city'];
        return value != null && (typeof value !== 'string' || value.length > 160);
      })
    )
      throw new BadRequestException('Invalid location.');
    Object.assign(values, normalizeProfileLocation(body.location));
  }
  if (body.birthYear !== undefined) {
    if (
      !Number.isInteger(body.birthYear) ||
      body.birthYear < new Date().getUTCFullYear() - 120 ||
      body.birthYear > new Date().getUTCFullYear()
    )
      throw new BadRequestException('Invalid birth year.');
    values.birth_year = body.birthYear;
  }
  if (body.gradeLevel !== undefined) {
    if (typeof body.gradeLevel !== 'string' || !parseGradeLevel(body.gradeLevel))
      throw new BadRequestException('Invalid grade level.');
    values.grade_level = parseGradeLevel(body.gradeLevel);
  }
  if (body.location)
    values.country_name =
      new Intl.DisplayNames(['en'], { type: 'region' }).of(
        body.location.countryCode.toUpperCase(),
      ) ?? body.location.countryCode;
  if (body.languagesSpoken !== undefined) {
    if (
      !Array.isArray(body.languagesSpoken) ||
      body.languagesSpoken.length > 10 ||
      body.languagesSpoken.some(
        (value) => typeof value !== 'string' || !value.trim() || value.trim().length > 80,
      )
    )
      throw new BadRequestException(
        'Enter up to 10 languages, with at most 80 characters each.',
      );
    values.languages_spoken = [
      ...new Set(body.languagesSpoken.map((value) => value.trim())),
    ];
  }
  return values;
}

const SECTION_FIELDS = {
  identity: ['firstName', 'lastName', 'displayName'],
  appearance: ['themeKey'],
  location: ['location'],
  regional: ['timezone', 'locale'],
  visibility: ['hideRole', 'hideStatus'],
  child: ['birthYear', 'gradeLevel'],
} as const;

export function normalizeProfileSettingsSection(
  body: import('@iconicedu/shared-types').ProfileSettingsSectionInput,
) {
  if (
    !body ||
    typeof body !== 'object' ||
    !body.values ||
    typeof body.values !== 'object'
  )
    throw new BadRequestException('Invalid section changes.');
  if (body.section === 'photo') {
    if (typeof body.values.avatarUrl !== 'string' || !body.values.avatarUrl)
      throw new BadRequestException('Choose a profile photo.');
    return {} as Record<string, unknown>;
  }
  if (body.section === 'about') {
    if (typeof body.values.bio !== 'string' || body.values.bio.length > 2000)
      throw new BadRequestException('Bio must be at most 2,000 characters.');
    return { bio: body.values.bio.trim() || null } as Record<string, unknown>;
  }
  if (
    typeof body.section !== 'string' ||
    !Object.prototype.hasOwnProperty.call(SECTION_FIELDS, body.section)
  )
    throw new BadRequestException('Unknown profile section.');
  const fields = SECTION_FIELDS[body.section];
  const selected: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field in body.values)) throw new BadRequestException(`Missing ${field}.`);
    selected[field] = (body.values as Record<string, unknown>)[field];
  }
  if (body.section === 'regional' && 'languagesSpoken' in body.values)
    selected.languagesSpoken = body.values.languagesSpoken;
  const normalized = normalizeProfileSettings({
    firstName: 'Unused',
    lastName: 'Unused',
    displayName: 'Unused',
    themeKey: 'green',
    timezone: 'UTC',
    locale: 'en-US',
    hideRole: false,
    hideStatus: false,
    ...selected,
  });
  const columns = {
    identity: ['first_name', 'last_name', 'display_name'],
    appearance: ['ui_theme_key'],
    location: ['country_code', 'country_name', 'city', 'region', 'postal_code'],
    regional: ['timezone', 'locale'],
    visibility: ['hide_role', 'hide_status'],
    child: ['birth_year', 'grade_level'],
  } as const;
  const result: Record<string, unknown> = Object.fromEntries(
    columns[body.section].map((column) => [column, normalized[column]]),
  );
  if (body.section === 'regional' && 'languagesSpoken' in selected)
    result.languages_spoken = normalized.languages_spoken;
  return result;
}
