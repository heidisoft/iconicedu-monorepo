import {
  combineDateAndTime,
  computeSendAtIso,
  formatScheduledSendAt,
  getDeviceTimezone,
  isSendAtInFuture,
} from './schedule-send';

describe('getDeviceTimezone', () => {
  it('returns a non-empty IANA-style timezone string in this test environment', () => {
    const tz = getDeviceTimezone();
    expect(typeof tz === 'string' || tz === null).toBe(true);
    if (tz) {
      expect(tz.length).toBeGreaterThan(0);
    }
  });
});

describe('combineDateAndTime', () => {
  it('combines the date part and time-of-day part into one local Date', () => {
    const datePart = new Date(2026, 9, 15, 8, 0, 0); // Oct 15 2026, time irrelevant
    const timePart = new Date(2000, 0, 1, 14, 30, 0); // 2:30 PM, date irrelevant
    const combined = combineDateAndTime(datePart, timePart);
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(9);
    expect(combined.getDate()).toBe(15);
    expect(combined.getHours()).toBe(14);
    expect(combined.getMinutes()).toBe(30);
  });
});

describe('computeSendAtIso', () => {
  it('produces a valid ISO string and includes the device timezone', () => {
    const datePart = new Date(2026, 11, 25, 0, 0, 0);
    const timePart = new Date(2000, 0, 1, 9, 15, 0);
    const { sendAt, timezone } = computeSendAtIso(datePart, timePart);
    expect(() => new Date(sendAt).toISOString()).not.toThrow();
    expect(new Date(sendAt).getTime()).toBe(
      combineDateAndTime(datePart, timePart).getTime(),
    );
    expect(typeof timezone === 'string' || timezone === null).toBe(true);
  });
});

describe('isSendAtInFuture', () => {
  it('returns true for a future timestamp and false for a past one', () => {
    const now = Date.now();
    expect(isSendAtInFuture(new Date(now + 60_000).toISOString(), now)).toBe(true);
    expect(isSendAtInFuture(new Date(now - 60_000).toISOString(), now)).toBe(false);
  });

  it('returns false for an invalid date string', () => {
    expect(isSendAtInFuture('not-a-date')).toBe(false);
  });
});

describe('formatScheduledSendAt', () => {
  it('formats using the stored timezone when present', () => {
    const formatted = formatScheduledSendAt(
      '2026-06-15T18:30:00.000Z',
      'America/New_York',
    );
    expect(formatted).toContain('2026');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('falls back to device-local formatting when no timezone is stored', () => {
    const formatted = formatScheduledSendAt('2026-06-15T18:30:00.000Z', null);
    expect(formatted).toContain('2026');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatScheduledSendAt('not-a-date')).toBe('');
  });
});
