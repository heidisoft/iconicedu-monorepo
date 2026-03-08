import { describe, expect, it } from 'vitest';

import {
  createFormDateFromIsoInTimezone,
  getDateFromISOInTimezone,
  getTimeFromISOInTimezone,
} from '@iconicedu/web/lib/admin/learning-space-detail';

describe('learning space detail schedule timezone helpers', () => {
  it('reads schedule times in the schedule timezone instead of the server timezone', () => {
    expect(getTimeFromISOInTimezone('2026-03-10T21:02:00.000Z', 'America/New_York')).toBe(
      '17:02',
    );
    expect(
      getTimeFromISOInTimezone('2026-03-10T21:02:00.000Z', 'America/Los_Angeles'),
    ).toBe('14:02');
  });

  it('reads occurrence dates in the schedule timezone', () => {
    expect(
      getDateFromISOInTimezone('2026-03-10T01:30:00.000Z', 'America/Los_Angeles'),
    ).toBe('2026-03-09');
    expect(getDateFromISOInTimezone('2026-03-10T21:02:00.000Z', 'America/New_York')).toBe(
      '2026-03-10',
    );
  });

  it('creates stable form dates from timezone-local schedule dates', () => {
    const formDate = createFormDateFromIsoInTimezone(
      '2026-03-10T21:02:00.000Z',
      'America/New_York',
    );

    expect(formDate?.toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });
});
