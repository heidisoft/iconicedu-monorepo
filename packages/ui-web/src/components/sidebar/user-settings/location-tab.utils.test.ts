import { describe, expect, it } from 'vitest';

import {
  isLocationComplete,
  normalizeReverseGeocodeAddress,
} from './location-tab.utils';

describe('location-tab utils', () => {
  it('normalizes reverse geocode fields into location values', () => {
    const result = normalizeReverseGeocodeAddress(
      {
        country_code: 'us',
        city: 'San Francisco',
        state: 'California',
        postcode: '94105',
        house_number: '415',
        road: 'Mission St',
      },
      [{ isoCode: 'US', name: 'United States' } as never],
    );

    expect(result).toEqual({
      countryCode: 'US',
      countryName: 'United States',
      city: 'San Francisco',
      region: 'California',
      postalCode: '94105',
      streetAddress: '415 Mission St',
    });
  });

  it('detects complete location payload', () => {
    expect(
      isLocationComplete({
        countryCode: 'US',
        city: 'Austin',
        region: 'Texas',
        postalCode: '73301',
      }),
    ).toBe(true);
  });

  it('detects incomplete location payload', () => {
    expect(
      isLocationComplete({
        countryCode: 'US',
        city: 'Austin',
        region: '',
        postalCode: '73301',
      }),
    ).toBe(false);
  });
});
