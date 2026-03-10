import { describe, expect, it } from 'vitest';

import { buildAdminScheduleSummary } from '@iconicedu/web/lib/admin/learning-spaces';

describe('buildAdminScheduleSummary', () => {
  it('formats weekly summaries with weekday names and AM/PM time', () => {
    const summary = buildAdminScheduleSummary(
      {
        startAt: new Date('2026-03-12T17:00:00.000Z'),
        endAt: new Date('2026-03-12T18:00:00.000Z'),
      },
      {
        frequency: 'weekly',
        byday: ['TH'],
        timezone: 'UTC',
      },
    );

    expect(summary).toEqual({
      kind: 'weekly',
      summary: 'Weekly · Every Thursday · 5:00 PM - 6:00 PM',
    });
  });

  it('formats no-repeat summaries', () => {
    const summary = buildAdminScheduleSummary(
      {
        startAt: new Date('2026-03-12T09:30:00.000Z'),
        endAt: new Date('2026-03-12T10:30:00.000Z'),
      },
      {
        timezone: 'UTC',
      },
    );

    expect(summary).toEqual({
      kind: 'none',
      summary: 'No repeat · 9:30 AM - 10:30 AM',
    });
  });
});
