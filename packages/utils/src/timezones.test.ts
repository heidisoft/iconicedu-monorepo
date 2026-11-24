import { describe, expect, it } from 'vitest';

import { countryCodeToEmoji, getTimezoneOptions } from './timezones';

describe('timezone utilities', () => {
  it('builds a sorted timezone options list with normalized shape', () => {
    const options = getTimezoneOptions();

    expect(options.length).toBeGreaterThan(100);
    expect(options[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        countryCode: expect.anything(),
        label: expect.any(String),
      }),
    );

    const firstTwoNames = options.slice(0, 2).map((option) => option.name);
    expect(firstTwoNames).toEqual([...firstTwoNames].sort((a, b) => a.localeCompare(b)));
  });

  it('converts country code to emoji flag', () => {
    expect(countryCodeToEmoji('US')).toBe('🇺🇸');
    expect(countryCodeToEmoji(null)).toBeNull();
  });
});

it('suggests the named timezone city and its unambiguous country without guessing an address', async () => {
  const { getTimezoneLocationHint } = await import('./timezones');
  expect(getTimezoneLocationHint('America/New_York')).toEqual({
    city: 'New York',
    countryCode: 'US',
  });
  expect(getTimezoneLocationHint('Asia/Colombo')).toEqual({
    city: 'Colombo',
    countryCode: 'LK',
  });
  expect(getTimezoneLocationHint('America/Argentina/Buenos_Aires')).toEqual({
    city: 'Buenos Aires',
    countryCode: 'AR',
  });
  expect(getTimezoneLocationHint('UTC')).toBeNull();
  expect(getTimezoneLocationHint('invalid')).toBeNull();
  expect(getTimezoneLocationHint('Europe/Paris')).toEqual({
    city: 'Paris',
    countryCode: 'FR',
  });
});
