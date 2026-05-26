import {
  buildLocalTimeContext,
  formatLocalTimeText,
  resolveLocalTimeIconKey,
} from './local-time-context';

describe('local time context', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the same time-of-day icon keys as the DM header', () => {
    expect(resolveLocalTimeIconKey({ timezone: 'Asia/Colombo' })).toBe('morning');
    expect(resolveLocalTimeIconKey({ timezone: 'America/New_York' })).toBe('evening');
    expect(
      resolveLocalTimeIconKey({
        timezone: 'Asia/Colombo',
        presenceStatus: 'offline',
      }),
    ).toBe('offline');
  });

  it('builds tooltip data from timezone and location', () => {
    const context = buildLocalTimeContext({
      timezone: 'Asia/Colombo',
      city: 'Colombo',
      countryCode: 'LK',
      presenceStatus: 'online',
    });

    expect(context).toMatchObject({
      icon: 'morning',
      descriptor: 'It is morning there',
    });
    expect(context?.tooltipLabel).toContain('Current time:');
    expect(context?.tooltipLabel).toContain('Location: Colombo, Sri Lanka');
  });

  it('returns null display text when timezone is unavailable', () => {
    expect(formatLocalTimeText(null)).toBeNull();
    expect(buildLocalTimeContext({ timezone: null })).toBeNull();
  });
});
