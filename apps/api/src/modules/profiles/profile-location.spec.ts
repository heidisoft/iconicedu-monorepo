import { normalizeProfileLocation, profileLocationError } from './profile-location';

const us = { countryCode: 'US', city: 'New York', region: 'New York' };
it.each(['', '1234', '123456', 'ABCDE'])(
  'rejects missing or invalid US ZIP %s',
  (postalCode) => {
    expect(() => normalizeProfileLocation({ ...us, postalCode })).toThrow();
  },
);
it.each(['10001', '10001-1234'])('accepts US ZIP %s', (postalCode) => {
  expect(normalizeProfileLocation({ ...us, postalCode }).postal_code).toBe(postalCode);
});
it('preserves leading zeroes in US ZIP codes', () => {
  expect(normalizeProfileLocation({ ...us, postalCode: '00501' }).postal_code).toBe(
    '00501',
  );
});
it('requires Canadian province and postal code and normalizes letter case', () => {
  expect(
    normalizeProfileLocation({
      countryCode: 'CA',
      city: 'Toronto',
      region: 'Ontario',
      postalCode: ' m5h 2n2 ',
    }).postal_code,
  ).toBe('M5H 2N2');
  expect(
    profileLocationError({ countryCode: 'CA', city: 'Toronto', postalCode: 'M5H 2N2' }),
  ).toContain('province');
});
it('does not require a UK county', () => {
  expect(
    normalizeProfileLocation({
      countryCode: 'GB',
      city: 'London',
      postalCode: 'SW1A 1AA',
    }).region,
  ).toBeNull();
});
it('does not ask Singapore for city or region and requires its postal code', () => {
  expect(
    normalizeProfileLocation({
      countryCode: 'SG',
      postalCode: '238823',
      city: 'stale',
      region: 'stale',
    }),
  ).toMatchObject({ city: null, region: null, postal_code: '238823' });
  expect(profileLocationError({ countryCode: 'SG' })).toContain('postal code');
});
it('omits postal codes where unused and allows optional postal codes where applicable', () => {
  expect(
    normalizeProfileLocation({ countryCode: 'AE', region: 'Dubai', postalCode: 'stale' })
      .postal_code,
  ).toBeNull();
  expect(
    normalizeProfileLocation({ countryCode: 'LK', city: 'Colombo' }).postal_code,
  ).toBeNull();
});
it('rejects unsupported country codes', () => {
  expect(profileLocationError({ countryCode: 'ZZ', city: 'Test' })).toContain(
    'valid country',
  );
});

it('rejects a state from another country and accepts recognized abbreviations', () => {
  expect(
    profileLocationError({
      countryCode: 'US',
      city: 'New York',
      region: 'Ontario',
      postalCode: '10001',
    }),
  ).toContain('valid state');
  expect(
    normalizeProfileLocation({
      countryCode: 'US',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
    }).region,
  ).toBe('New York');
});
