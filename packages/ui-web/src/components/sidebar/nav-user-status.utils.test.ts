import { describe, expect, it } from 'vitest';

import { computeStatusExpiresAt } from './nav-user-status.utils';

describe('computeStatusExpiresAt', () => {
  it('returns null for never', () => {
    expect(computeStatusExpiresAt('never')).toBeNull();
  });

  it('adds 30 minutes', () => {
    const now = new Date('2026-02-16T10:00:00.000Z');
    expect(computeStatusExpiresAt('30m', now)).toBe('2026-02-16T10:30:00.000Z');
  });

  it('adds 1 hour', () => {
    const now = new Date('2026-02-16T10:00:00.000Z');
    expect(computeStatusExpiresAt('1h', now)).toBe('2026-02-16T11:00:00.000Z');
  });

  it('sets end of day for today', () => {
    const now = new Date(2026, 1, 16, 10, 15, 0, 0);
    const expected = new Date(now.getTime());
    expected.setHours(23, 59, 59, 999);
    expect(computeStatusExpiresAt('today', now)).toBe(expected.toISOString());
  });
});
