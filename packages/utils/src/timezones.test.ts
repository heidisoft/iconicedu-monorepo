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
