import { timezoneCity, timezoneOption, timezoneIds } from './timezone-options';

it('shows a readable city and region for multi-part identifiers', () => {
  expect(timezoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  expect(timezoneOption('America/Argentina/Buenos_Aires')).toEqual(
    expect.objectContaining({
      id: 'America/Argentina/Buenos_Aires',
      label: 'Buenos Aires',
      subtitle: 'America / Argentina',
    }),
  );
});

it('shows the date-appropriate UTC offset and keeps the canonical identifier', () => {
  expect(
    timezoneOption('America/New_York', new Date('2026-01-15T12:00:00Z')).detail,
  ).toBe('UTC-05:00');
  expect(
    timezoneOption('America/New_York', new Date('2026-07-15T12:00:00Z')).detail,
  ).toBe('UTC-04:00');
  expect(timezoneOption('Asia/Colombo', new Date('2026-01-15T12:00:00Z')).detail).toBe(
    'UTC+05:30',
  );
  expect(timezoneOption('UTC').label).toBe('UTC');
});

it('does not depend on shortOffset names being supported by Hermes', () => {
  const original = Intl.DateTimeFormat;
  const formatter = jest
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation((locale, options) => {
      if (options?.timeZoneName === 'shortOffset') throw new Error('Unsupported');
      return new original(locale, options);
    });
  try {
    expect(
      timezoneOption('America/New_York', new Date('2026-11-23T18:00:00Z')).detail,
    ).toBe('UTC-05:00');
    expect(timezoneOption('UTC', new Date('2026-11-23T18:00:00Z')).detail).toBe(
      'UTC+00:00',
    );
  } finally {
    formatter.mockRestore();
  }
});

it('falls back to the full city list if a runtime returns only UTC', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
  Object.defineProperty(Intl, 'supportedValuesOf', {
    configurable: true,
    value: () => ['UTC'],
  });
  try {
    const ids = timezoneIds();
    expect(ids.length).toBeGreaterThan(100);
    expect(ids).toContain('America/New_York');
    expect(ids).toContain('Asia/Colombo');
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'supportedValuesOf', descriptor);
    else Reflect.deleteProperty(Intl, 'supportedValuesOf');
  }
});
