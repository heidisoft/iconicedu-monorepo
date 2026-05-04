import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';

const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;

type ReminderReconcileJobRow = {
  id: string;
  org_id: string;
  schedule_id: string;
  dedupe_key: string;
  status: 'pending' | 'leased' | 'succeeded' | 'failed' | 'dead_letter' | 'canceled';
  attempt_count: number;
  max_attempts: number;
  run_at: string;
  lease_owner?: string | null;
  lease_until?: string | null;
  next_attempt_at?: string | null;
  last_error?: string | null;
  dispatched_at?: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

@Injectable()
export class ReminderReconcileWorkerService {
  constructor(
    private readonly reminderReconcileService: ReminderReconcileService,
    private readonly analytics: AnalyticsService,
  ) {}

  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  async dispatchDuePendingJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const supabase = this.getSupabase();
    const runId = randomUUID();
    const startedAt = Date.now();

    const claimResponse = await supabase.rpc('claim_due_reminder_reconcile_jobs', {
      p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
      p_lease_owner: input.leaseOwner,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    });

    if (claimResponse.error) {
      throw new Error(claimResponse.error.message);
    }

    const claimed = (claimResponse.data ?? []) as ReminderReconcileJobRow[];
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const job of claimed) {
      try {
        await this.processJob(job, supabase);
        succeeded += 1;
      } catch (error) {
        const result = await this.markFailed(job, supabase, error);
        failed += 1;
        if (result === 'dead_letter') {
          deadLettered += 1;
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    this.analytics.capture('api reminder reconcile worker completed', {
      runId,
      claimed: claimed.length,
      succeeded,
      failed,
      deadLettered,
      durationMs,
    });

    return {
      runId,
      claimed: claimed.length,
      succeeded,
      failed,
      deadLettered,
      durationMs,
    };
  }

  private async processJob(
    job: ReminderReconcileJobRow,
    supabase: SupabaseServiceClient,
  ) {
    await this.reminderReconcileService.reconcileNextReminderJobForSchedule({
      orgId: job.org_id,
      scheduleId: job.schedule_id,
    });

    const now = new Date().toISOString();
    const response = await supabase
      .from('reminder_reconcile_jobs')
      .update({
        status: 'succeeded',
        dispatched_at: now,
        lease_owner: null,
        lease_until: null,
        next_attempt_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('org_id', job.org_id);

    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  private async markFailed(
    job: ReminderReconcileJobRow,
    supabase: SupabaseServiceClient,
    error: unknown,
  ): Promise<'failed' | 'dead_letter'> {
    const message = error instanceof Error ? error.message : String(error);
    const nextAttemptCount = job.attempt_count + 1;
    const retryable =
      this.isRetryableError(error) && nextAttemptCount < (job.max_attempts ?? 8);
    const nextStatus = retryable ? 'failed' : 'dead_letter';
    const now = new Date();
    const nextAttemptAt = new Date(
      now.getTime() + this.resolveRetryDelayMs(nextAttemptCount),
    ).toISOString();

    const response = await supabase
      .from('reminder_reconcile_jobs')
      .update({
        status: nextStatus,
        attempt_count: nextAttemptCount,
        next_attempt_at: retryable ? nextAttemptAt : null,
        last_error: message,
        lease_owner: null,
        lease_until: null,
        updated_at: now.toISOString(),
      })
      .eq('id', job.id)
      .eq('org_id', job.org_id);

    if (response.error) {
      throw new Error(response.error.message);
    }

    this.analytics.capture('api reminder reconcile job failed', {
      jobId: job.id,
      orgId: job.org_id,
      scheduleId: job.schedule_id,
      attemptCount: nextAttemptCount,
      nextStatus,
      errorMessage: message,
    });

    return nextStatus;
  }

  private resolveRetryDelayMs(attemptCount: number) {
    const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
    const jitter = Math.floor(Math.random() * 2_000);
    return Math.min(RETRY_MAX_MS, exponential + jitter);
  }

  private isRetryableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return !/invalid|unauthorized|forbidden/i.test(message);
  }
}
