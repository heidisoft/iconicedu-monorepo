import { describe, expect, it } from 'vitest';
import { getCountryAddressFields } from './country-address';
import { PROFILE_COUNTRIES } from './profile-countries';
import { PROFILE_COUNTRY_CODES } from './country-address';
import { COUNTRY_ADDRESS_METADATA } from './country-address-metadata';

describe('country address presentation', () => {
  it.each(['US', 'CA', 'GB', 'AU', 'NZ', 'IN', 'SG'])(
    'requires postal codes for %s',
    (code) => {
      expect(getCountryAddressFields(code)?.postal).toMatchObject({
        visible: true,
        required: true,
      });
    },
  );
  it('uses local labels and omits irrelevant fields', () => {
    expect(getCountryAddressFields('US')?.postal.label).toBe('ZIP code');
    expect(getCountryAddressFields('CA')?.region.label).toBe('Province');
    expect(getCountryAddressFields('IN')?.postal.label).toBe('PIN code');
    expect(getCountryAddressFields('GB')?.region.visible).toBe(false);
    expect(getCountryAddressFields('SG')?.city.visible).toBe(false);
    expect(getCountryAddressFields('AE')?.region).toMatchObject({
      label: 'Emirate',
      required: true,
    });
    expect(getCountryAddressFields('AE')?.postal.visible).toBe(false);
    expect(getCountryAddressFields('LK')?.postal.required).toBe(false);
  });
  it('has well-formed patterns that accept each country postal example', () => {
    for (const [code, data] of Object.entries(COUNTRY_ADDRESS_METADATA)) {
      if (!data.postalPattern || !data.postalExample) continue;
      expect(
        new RegExp(`^(?:${data.postalPattern})$`, 'i').test(data.postalExample),
        code,
      ).toBe(true);
    }
  });
});

import { getCountryRegions, findCountryRegion } from './country-regions';

it('provides region lists and matches local names and abbreviations', () => {
  expect(getCountryRegions('US').length).toBeGreaterThan(50);
  expect(findCountryRegion('US', 'NY')?.label).toBe('New York');
  expect(findCountryRegion('CA', 'Québec')?.label).toBe('Quebec');
  expect(findCountryRegion('AE', 'DU')?.label).toBe('Dubai');
  expect(getCountryRegions('LK')).toEqual([]);
});

describe('profile country labels', () => {
  it('includes every supported address country once with a readable name', () => {
    expect(PROFILE_COUNTRIES).toHaveLength(252);
    expect(PROFILE_COUNTRIES.map((country) => country.code).sort()).toEqual(
      [...PROFILE_COUNTRY_CODES].sort(),
    );
    expect(new Set(PROFILE_COUNTRIES.map((country) => country.code)).size).toBe(
      PROFILE_COUNTRIES.length,
    );
    for (const country of PROFILE_COUNTRIES) {
      expect(country.label.length).toBeGreaterThan(2);
      expect(country.label).not.toBe(country.code);
    }
    expect(PROFILE_COUNTRIES).toEqual(
      expect.arrayContaining([
        { code: 'US', label: 'United States' },
        { code: 'LK', label: 'Sri Lanka' },
        { code: 'GB', label: 'United Kingdom' },
      ]),
    );
  });
});
