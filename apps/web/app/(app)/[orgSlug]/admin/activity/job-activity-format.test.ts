import { describe, expect, it } from 'vitest';
import type { AdminJobActivityRecordVM } from '@iconicedu/shared-types';

import {
  buildJobActivityStatusSegments,
  buildJobActivityVolume,
  filterJobActivityRecords,
  formatJobActivityAttempts,
  jobActivityStatusTone,
  jobActivityStatusVariant,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';

function record(overrides: Partial<AdminJobActivityRecordVM>): AdminJobActivityRecordVM {
  return {
    id: 'job-1',
    status: 'succeeded',
    label: 'message',
    message: null,
    participants: [],
    occurrenceAt: null,
    priority: null,
    detail: 'dedupe-1',
    attemptCount: 1,
    maxAttempts: 8,
    lastError: null,
    runAt: null,
    dispatchedAt: null,
    createdAt: '2026-09-09T09:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('jobActivityStatusVariant', () => {
  it('maps terminal-success statuses to default', () => {
    expect(jobActivityStatusVariant('succeeded')).toBe('default');
    expect(jobActivityStatusVariant('CONFIRMED')).toBe('default');
  });

  it('maps failure statuses to destructive', () => {
    expect(jobActivityStatusVariant('failed')).toBe('destructive');
    expect(jobActivityStatusVariant('dead_letter')).toBe('destructive');
    expect(jobActivityStatusVariant('disputed')).toBe('destructive');
  });

  it('maps in-flight statuses to secondary', () => {
    expect(jobActivityStatusVariant('pending')).toBe('secondary');
    expect(jobActivityStatusVariant('leased')).toBe('secondary');
  });
});

describe('formatJobActivityAttempts', () => {
  it('renders count over max when both are present', () => {
    expect(formatJobActivityAttempts({ attemptCount: 2, maxAttempts: 8 })).toBe('2 / 8');
  });

  it('falls back to a dash when no attempt tracking exists', () => {
    expect(formatJobActivityAttempts({ attemptCount: null, maxAttempts: null })).toBe(
      '—',
    );
  });
});

describe('jobActivityStatusTone', () => {
  it('groups statuses into semantic tones', () => {
    expect(jobActivityStatusTone('succeeded')).toBe('success');
    expect(jobActivityStatusTone('dead_letter')).toBe('destructive');
    expect(jobActivityStatusTone('retryable_failure')).toBe('warning');
    expect(jobActivityStatusTone('leased')).toBe('info');
    expect(jobActivityStatusTone('suppressed')).toBe('muted');
    expect(jobActivityStatusTone('something-new')).toBe('muted');
  });
});

describe('buildJobActivityStatusSegments', () => {
  it('computes percentages and orders by count desc', () => {
    const { segments, total } = buildJobActivityStatusSegments([
      { status: 'succeeded', count: 3 },
      { status: 'failed', count: 1 },
    ]);

    expect(total).toBe(4);
    expect(segments.map((segment) => segment.status)).toEqual(['succeeded', 'failed']);
    expect(segments[0]).toMatchObject({ tone: 'success', percent: 75 });
    expect(segments[1]).toMatchObject({ tone: 'destructive', percent: 25 });
  });

  it('handles an empty distribution', () => {
    expect(buildJobActivityStatusSegments([])).toEqual({ segments: [], total: 0 });
  });
});

describe('buildJobActivityVolume', () => {
  it('buckets by hour when the sample spans less than a day and a half', () => {
    const volume = buildJobActivityVolume([
      { createdAt: '2026-09-09T10:15:00.000Z' },
      { createdAt: '2026-09-09T10:45:00.000Z' },
      { createdAt: '2026-09-09T12:05:00.000Z' },
    ]);

    expect(volume.granularity).toBe('hour');
    expect(volume.total).toBe(3);
    expect(volume.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
    expect(volume.buckets[0]?.count).toBe(2);
  });

  it('buckets by day for multi-day samples', () => {
    const volume = buildJobActivityVolume([
      { createdAt: '2026-09-01T09:00:00.000Z' },
      { createdAt: '2026-09-05T09:00:00.000Z' },
      { createdAt: '2026-09-05T18:00:00.000Z' },
    ]);

    expect(volume.granularity).toBe('day');
    expect(volume.total).toBe(3);
  });

  it('returns no buckets for an empty sample', () => {
    expect(buildJobActivityVolume([])).toEqual({
      granularity: 'day',
      buckets: [],
      total: 0,
    });
  });
});

describe('filterJobActivityRecords', () => {
  const records = [
    record({ id: 'a', status: 'succeeded', label: 'message', detail: 'alpha' }),
    record({
      id: 'b',
      status: 'failed',
      label: 'reaction',
      detail: 'beta',
      lastError: 'timeout',
    }),
  ];

  it('filters by status', () => {
    expect(
      filterJobActivityRecords(records, { search: '', status: 'failed' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b']);
  });

  it('matches search against label, detail, and error text', () => {
    expect(
      filterJobActivityRecords(records, { search: 'timeout', status: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b']);
    expect(
      filterJobActivityRecords(records, { search: 'MESSAGE', status: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['a']);
  });

  it('matches search against the message text and participants', () => {
    const enriched = [
      record({ id: 'x', message: 'Class starts in 30 minutes', participants: [] }),
      record({ id: 'y', participants: ['Scott S · child', 'Denise R · educator'] }),
    ];

    expect(
      filterJobActivityRecords(enriched, { search: '30 minutes', status: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['x']);
    expect(
      filterJobActivityRecords(enriched, { search: 'denise', status: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['y']);
  });
});
