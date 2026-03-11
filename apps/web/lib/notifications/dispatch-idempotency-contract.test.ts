import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('notification dispatch idempotency contract', () => {
  it('keeps DB unique index aligned with upsert onConflict key', () => {
    const migrationSql = readFileSync(
      resolve(
        process.cwd(),
        '..',
        '..',
        'supabase',
        'migrations',
        '20260311120000_034_notification_dispatch_jobs.sql',
      ),
      'utf8',
    );
    const dispatchJobsSource = readFileSync(
      resolve(process.cwd(), 'lib', 'notifications', 'dispatch-jobs.ts'),
      'utf8',
    );

    expect(migrationSql).toContain(
      'create unique index if not exists notification_dispatch_jobs_idempotency_idx',
    );
    expect(migrationSql).toContain('activity_event_id');
    expect(migrationSql).toContain('recipient_profile_id');
    expect(migrationSql).toContain('delivery_channel');
    expect(migrationSql).toContain('attempt_bucket');

    expect(dispatchJobsSource).toContain(
      "onConflict: 'activity_event_id,recipient_profile_id,delivery_channel,attempt_bucket'",
    );
  });
});
