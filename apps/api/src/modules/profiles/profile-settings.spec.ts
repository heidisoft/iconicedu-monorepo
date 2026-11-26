import { BadRequestException } from '@nestjs/common';
import {
  normalizeProfileSettings,
  normalizeProfileSettingsSection,
} from './profile-settings';

const valid = {
  firstName: ' Jane ',
  lastName: ' Smith ',
  displayName: ' Coach J ',
  themeKey: 'blue',
  timezone: 'America/New_York',
  locale: 'en-US',
  hideRole: true,
  hideStatus: false,
};

it('normalizes names and maps only editable fields', () => {
  expect(
    normalizeProfileSettings({
      ...valid,
      status: 'active',
      kind: 'staff',
    } as typeof valid),
  ).toEqual({
    first_name: 'Jane',
    last_name: 'Smith',
    display_name: 'Coach J',
    ui_theme_key: 'blue',
    timezone: 'America/New_York',
    locale: 'en-US',
    hide_role: true,
    hide_status: false,
  });
});
it.each([
  { firstName: '' },
  { lastName: 'x'.repeat(101) },
  { displayName: 5 },
  { themeKey: 'invalid' },
  { timezone: 'Invalid/Zone' },
  { locale: '<invalid>' },
  { hideRole: 'true' },
  { hideStatus: null },
  { birthYear: 9999 },
  { gradeLevel: 'invalid' },
  {
    location: {
      countryCode: 'US',
      city: 'New York',
      region: 'New York',
      postalCode: 'bad',
    },
  },
  { location: { countryCode: 'US', city: 123 } },
])('rejects invalid presentation data: %j', (changes) => {
  expect(() =>
    normalizeProfileSettings({ ...valid, ...changes } as typeof valid),
  ).toThrow(BadRequestException);
});
it('validates child data and normalizes country address fields', () => {
  expect(
    normalizeProfileSettings({
      ...valid,
      birthYear: 2015,
      gradeLevel: 'grade_5',
      location: {
        countryCode: 'US',
        city: ' New York ',
        region: 'NY',
        postalCode: '10001',
      },
    }),
  ).toEqual(
    expect.objectContaining({
      birth_year: 2015,
      city: 'New York',
      region: 'New York',
      postal_code: '10001',
    }),
  );
});

it('updates only the selected section even when other fields are submitted', () => {
  expect(
    normalizeProfileSettingsSection({
      section: 'regional',
      values: { timezone: 'UTC', locale: 'en-GB', firstName: 'Injected' },
    } as unknown as import('@iconicedu/shared-types').ProfileSettingsSectionInput),
  ).toEqual({ timezone: 'UTC', locale: 'en-GB' });
});
it('allows editing visibility when legacy names are not populated', () => {
  expect(
    normalizeProfileSettingsSection({
      section: 'visibility',
      values: { hideRole: true, hideStatus: false },
    }),
  ).toEqual({ hide_role: true, hide_status: false });
});
it('rejects missing section fields instead of clearing existing values', () => {
  expect(() =>
    normalizeProfileSettingsSection({
      section: 'identity',
      values: { firstName: 'Jane' },
    } as import('@iconicedu/shared-types').ProfileSettingsSectionInput),
  ).toThrow(BadRequestException);
});
it.each(['constructor', '__proto__', 'unknown'])(
  'rejects unsupported section %s',
  (section) => {
    expect(() =>
      normalizeProfileSettingsSection({
        section,
        values: {},
      } as import('@iconicedu/shared-types').ProfileSettingsSectionInput),
    ).toThrow(BadRequestException);
  },
);
it('normalizes bio without writing other fields', () => {
  expect(
    normalizeProfileSettingsSection({ section: 'about', values: { bio: ' Hello ' } }),
  ).toEqual({ bio: 'Hello' });
  expect(
    normalizeProfileSettingsSection({ section: 'about', values: { bio: ' ' } }),
  ).toEqual({ bio: null });
});

it('validates and normalizes spoken languages within the regional section', () => {
  expect(
    normalizeProfileSettingsSection({
      section: 'regional',
      values: {
        timezone: 'UTC',
        locale: 'en-US',
        languagesSpoken: [' English ', 'Sinhala', 'English'],
      },
    }),
  ).toEqual({
    timezone: 'UTC',
    locale: 'en-US',
    languages_spoken: ['English', 'Sinhala'],
  });
  expect(() =>
    normalizeProfileSettingsSection({
      section: 'regional',
      values: { timezone: 'UTC', locale: 'en-US', languagesSpoken: [''] },
    }),
  ).toThrow(BadRequestException);
});

it('accepts a dedicated photo section without writing identity or accent fields', () => {
  expect(
    normalizeProfileSettingsSection({
      section: 'photo',
      values: { avatarUrl: 'https://example.invalid/photo.jpg' },
    }),
  ).toEqual({});
  expect(() =>
    normalizeProfileSettingsSection({ section: 'photo', values: { avatarUrl: '' } }),
  ).toThrow(BadRequestException);
});
