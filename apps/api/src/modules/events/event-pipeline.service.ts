import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventPipelineJobKind, EventPipelineJobRow } from '@iconicedu/shared-types';

import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { ActivityWorkerService } from '@iconicedu/api/modules/activity-worker/activity-worker.service';
import { NotificationService } from '@iconicedu/api/modules/events/notification.service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;

function resolveRetryDelayMs(attemptCount: number) {
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
  const jitter = Math.floor(Math.random() * 2_000);
  return Math.min(RETRY_MAX_MS, exponential + jitter);
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/invalid|unauthorized|forbidden|not found|missing/i.test(message);
}

@Injectable()
export class EventPipelineService {
  constructor(
    private readonly activityWorkerService: ActivityWorkerService,
    private readonly notificationService: NotificationService,
    private readonly reminderReconcileService: ReminderReconcileService,
    private readonly remindersService: RemindersService,
  ) {}

  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  async dispatchDueJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
    jobKinds?: EventPipelineJobKind[];
  }) {
    const supabase = this.getSupabase();
    const runId = randomUUID();
    const startedAt = Date.now();
    const claimResponse = await supabase.rpc('claim_due_event_pipeline_jobs', {
      p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
      p_lease_owner: input.leaseOwner,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
      p_job_kinds: input.jobKinds?.length ? input.jobKinds : null,
    });

    if (claimResponse.error) {
      throw new Error(claimResponse.error.message);
    }

    const jobs = (claimResponse.data ?? []) as EventPipelineJobRow[];
    let succeeded = 0;
    let suppressed = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const job of jobs) {
      try {
        const result = await this.processJob(supabase, job);
        if (result?.status === 'suppressed') {
          await this.markSuppressed(supabase, job, result.details);
          suppressed += 1;
        } else {
          await this.markSucceeded(supabase, job, result?.details);
          succeeded += 1;
        }
      } catch (error) {
        const deadLetter = await this.markFailedOrDeadLetter(supabase, job, error);
        failed += 1;
        if (deadLetter) deadLettered += 1;
      }
    }

    return {
      runId,
      claimed: jobs.length,
      succeeded,
      suppressed,
      failed,
      deadLettered,
      durationMs: Date.now() - startedAt,
    };
  }

  private async processJob(supabase: SupabaseServiceClient, job: EventPipelineJobRow) {
    if (job.job_kind === 'activity.generate') {
      await this.activityWorkerService.processEventPipelineGenerationJob(job, supabase);
      await this.markOutboxProcessed(supabase, job);
      return { details: { sourceKind: job.source_kind ?? null } };
    }

    if (job.job_kind === 'activity.project') {
      const eventId =
        typeof job.payload?.eventId === 'string' ? job.payload.eventId : job.source_id;
      if (!eventId) {
        throw new Error('Missing eventId for activity.project job');
      }
      const result = await projectActivityEvents(supabase, {
        eventIds: [eventId],
        limit: 1,
      });
      return { details: result };
    }

    if (job.job_kind === 'notification.prepare') {
      const eventId =
        typeof job.payload?.eventId === 'string' ? job.payload.eventId : job.source_id;
      const recipientProfileIds = Array.isArray(job.payload?.recipientProfileIds)
        ? job.payload.recipientProfileIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];
      if (!eventId) {
        throw new Error('Missing eventId for notification.prepare job');
      }
      const result = await this.notificationService.prepareForActivityEvent({
        supabase,
        eventId,
        recipientProfileIds,
        createdBy: job.created_by ?? null,
      });
      return result.suppressed
        ? { status: 'suppressed' as const, details: result }
        : { details: result };
    }

    if (job.job_kind === 'notification.deliver') {
      const result = await this.notificationService.deliver({ supabase, job });
      if (result && 'suppressed' in result && result.suppressed) {
        return { status: 'suppressed' as const, details: result };
      }
      return { details: result ?? {} };
    }

    if (job.job_kind === 'reminder.reconcile') {
      const scheduleId =
        typeof job.payload?.scheduleId === 'string'
          ? job.payload.scheduleId
          : job.source_id;
      if (!scheduleId) {
        throw new Error('Missing scheduleId for reminder.reconcile job');
      }
      const result =
        await this.reminderReconcileService.reconcileNextReminderJobForSchedule({
          orgId: job.org_id,
          scheduleId,
        });
      return { details: result as unknown as Record<string, unknown> };
    }

    if (job.job_kind === 'reminder.dispatch') {
      const result = await this.remindersService.dispatchDueReminderJobs({
        leaseOwner: `event-pipeline:${job.id}`,
        limit:
          typeof job.payload?.limit === 'number'
            ? Math.max(1, Math.floor(job.payload.limit))
            : 100,
        leaseSeconds:
          typeof job.payload?.leaseSeconds === 'number'
            ? Math.max(30, Math.floor(job.payload.leaseSeconds))
            : 120,
      });
      return { details: result as unknown as Record<string, unknown> };
    }

    throw new Error(`Unsupported event pipeline job kind: ${job.job_kind}`);
  }

  private async markOutboxProcessed(
    supabase: SupabaseServiceClient,
    job: EventPipelineJobRow,
  ) {
    if (!job.outbox_id) {
      return;
    }
    const now = new Date().toISOString();
    const response = await supabase
      .from('event_outbox')
      .update({
        status: 'processed',
        processed_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq('id', job.outbox_id)
      .eq('org_id', job.org_id);
    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  private async markSucceeded(
    supabase: SupabaseServiceClient,
    job: EventPipelineJobRow,
    details?: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const response = await supabase
      .from('event_pipeline_jobs')
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
    await this.log(supabase, job, 'succeeded', details ?? {});
  }

  private async markSuppressed(
    supabase: SupabaseServiceClient,
    job: EventPipelineJobRow,
    details?: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const response = await supabase
      .from('event_pipeline_jobs')
      .update({
        status: 'suppressed',
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
    await this.log(supabase, job, 'suppressed', details ?? {});
  }

  private async markFailedOrDeadLetter(
    supabase: SupabaseServiceClient,
    job: EventPipelineJobRow,
    error: unknown,
  ) {
    const now = new Date();
    const nextAttemptCount = (job.attempt_count ?? 0) + 1;
    const retryable = isRetryableError(error);
    const shouldDeadLetter = !retryable || nextAttemptCount >= (job.max_attempts ?? 8);
    const lastError = error instanceof Error ? error.message : String(error);
    const response = await supabase
      .from('event_pipeline_jobs')
      .update(
        shouldDeadLetter
          ? {
              status: 'dead_letter',
              attempt_count: nextAttemptCount,
              lease_owner: null,
              lease_until: null,
              next_attempt_at: null,
              last_error: lastError,
              updated_at: now.toISOString(),
            }
          : {
              status: 'failed',
              attempt_count: nextAttemptCount,
              lease_owner: null,
              lease_until: null,
              next_attempt_at: new Date(
                now.getTime() + resolveRetryDelayMs(nextAttemptCount),
              ).toISOString(),
              last_error: lastError,
              updated_at: now.toISOString(),
            },
      )
      .eq('id', job.id)
      .eq('org_id', job.org_id);
    if (response.error) {
      throw new Error(response.error.message);
    }

    if (job.outbox_id) {
      await supabase
        .from('event_outbox')
        .update({
          status: shouldDeadLetter ? 'dead_letter' : 'failed',
          last_error: lastError,
          updated_at: now.toISOString(),
        })
        .eq('id', job.outbox_id)
        .eq('org_id', job.org_id);
    }

    await this.log(
      supabase,
      job,
      shouldDeadLetter ? 'fatal_failure' : 'retryable_failure',
      { error: lastError },
    );
    return shouldDeadLetter;
  }

  private async log(
    supabase: SupabaseServiceClient,
    job: EventPipelineJobRow,
    result:
      | 'succeeded'
      | 'suppressed'
      | 'retryable_failure'
      | 'fatal_failure'
      | 'canceled',
    details: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const response = await supabase.from('event_pipeline_logs').insert({
      org_id: job.org_id,
      job_id: job.id,
      outbox_id: job.outbox_id ?? null,
      job_kind: job.job_kind,
      result,
      details,
      created_at: now,
      updated_at: now,
    });
    if (response.error) {
      throw new Error(response.error.message);
    }
  }
}
