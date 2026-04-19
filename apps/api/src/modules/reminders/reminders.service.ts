import { Injectable } from '@nestjs/common';
import type { FeedScopeVM, ReminderJobRow } from '@iconicedu/shared-types';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';

const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;

type ReminderJobPayload = {
  title: string;
  summary?: string | null;
  description?: string | null;
  channelId: string;
  learningSpaceId?: string | null;
  scheduleId?: string | null;
  occurrenceStart?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  invoiceId?: string | null;
  dueAt?: string | null;
  amount?: number | null;
  currency?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: string;
    role?: 'educator' | 'child' | 'guardian' | 'staff' | 'observer' | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
};

@Injectable()
export class RemindersService {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Keep Supabase env validation out of Nest bootstrap so the API can expose
   * health and startup errors cleanly before reminder jobs are invoked.
   */
  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  async dispatchDueReminderJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const supabase = this.getSupabase();
    const runId = randomUUID();
    const startedAt = Date.now();

    const claimResponse = await supabase.rpc('claim_due_reminder_jobs', {
      p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
      p_lease_owner: input.leaseOwner,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    });

    if (claimResponse.error) {
      throw new Error(claimResponse.error.message);
    }

    const claimed = (claimResponse.data ?? []) as ReminderJobRow[];
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const job of claimed) {
      try {
        await this.processReminderJob(job, supabase);
        succeeded += 1;
      } catch (error) {
        this.analytics.capture('api reminder job failed', {
          jobId: job.id,
          orgId: job.org_id,
          jobType: job.job_type,
          attemptCount: job.attempt_count + 1,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        const now = new Date();
        const nextAttemptAt = new Date(
          now.getTime() + this.resolveRetryDelayMs(job.attempt_count + 1),
        ).toISOString();
        const retryable =
          this.isRetryableError(error) && job.attempt_count + 1 < job.max_attempts;
        const nextStatus = retryable ? 'failed' : 'dead_letter';
        const message = error instanceof Error ? error.message : String(error);

        const response = await supabase
          .from('reminder_jobs')
          .update({
            status: nextStatus,
            attempt_count: job.attempt_count + 1,
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

        await this.logDispatch({
          supabase,
          orgId: job.org_id,
          jobId: job.id,
          result: retryable ? 'retryable_failure' : 'fatal_failure',
          details: {
            error_class: error instanceof Error ? error.name : 'Error',
            error: message,
            attempt_count: job.attempt_count + 1,
            next_status: nextStatus,
          },
        });

        failed += 1;
        if (!retryable) {
          deadLettered += 1;
        }
      }
    }

    const durationMs = Date.now() - startedAt;

    this.analytics.capture('api reminders dispatch completed', {
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
      skipped: 0,
      deadLettered,
      durationMs,
    };
  }

  private resolveRetryDelayMs(attemptCount: number) {
    const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
    const jitter = Math.floor(Math.random() * 2_000);
    return Math.min(RETRY_MAX_MS, exponential + jitter);
  }

  private isRetryableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return !/invalid|unauthorized|forbidden|not found|missing/i.test(message);
  }

  private async ensureSystemProfileId(
    supabase: SupabaseServiceClient,
    orgId: string,
  ): Promise<string> {
    const existing = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('kind', 'system')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existing.error) {
      throw new Error(existing.error.message);
    }
    if (existing.data?.id) {
      return existing.data.id;
    }

    const now = new Date().toISOString();
    const accountResponse = await supabase
      .from('accounts')
      .insert({
        org_id: orgId,
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single<{ id: string }>();

    if (accountResponse.error) {
      throw new Error(accountResponse.error.message);
    }

    const profileResponse = await supabase
      .from('profiles')
      .insert({
        org_id: orgId,
        account_id: accountResponse.data.id,
        kind: 'system',
        display_name: 'System',
        first_name: 'System',
        last_name: null,
        avatar_source: 'seed',
        avatar_seed: `system:${orgId}:${randomUUID()}`,
        timezone: 'UTC',
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single<{ id: string }>();

    if (profileResponse.error) {
      throw new Error(profileResponse.error.message);
    }

    return profileResponse.data.id;
  }

  private async logDispatch(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    jobId: string;
    activityEventId?: string | null;
    result: 'succeeded' | 'idempotent_hit' | 'retryable_failure' | 'fatal_failure';
    details?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const response = await input.supabase.from('reminder_dispatch_logs').insert({
      org_id: input.orgId,
      reminder_job_id: input.jobId,
      message_id: null,
      activity_event_id: input.activityEventId ?? null,
      result: input.result,
      details: input.details ?? {},
      created_at: now,
      updated_at: now,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  private async processReminderJob(job: ReminderJobRow, supabase: SupabaseServiceClient) {
    const payload = (job.payload ?? {}) as ReminderJobPayload;
    const now = new Date().toISOString();

    const systemProfileId = await this.ensureSystemProfileId(supabase, job.org_id);

    const eventType =
      job.job_type === 'payment.reminder'
        ? 'payment.reminder.sent'
        : job.job_type === 'session.feedback_request'
          ? 'session.feedback_request.sent'
          : 'session.reminder.sent';

    const scope: FeedScopeVM = payload.learningSpaceId
      ? { kind: 'learning_space', learningSpaceId: payload.learningSpaceId }
      : { kind: 'channel', channelId: payload.channelId };

    const activityEvent = await publishActivityEvent({
      supabase: supabase as never,
      orgId: job.org_id,
      eventType,
      emitterLabel: 'api:reminders',
      occurredAt: now,
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope,
      targetRef: payload.learningSpaceId
        ? { kind: 'learning_space', id: payload.learningSpaceId }
        : undefined,
      payload: {
        channelId: payload.channelId,
        learningSpaceId: payload.learningSpaceId ?? null,
        scheduleId: payload.scheduleId ?? null,
        occurrenceStart: payload.occurrenceStart ?? payload.startAt ?? now,
        invoiceId: payload.invoiceId ?? null,
        dueAt: payload.dueAt ?? null,
        title: payload.title,
        summary: payload.summary ?? null,
        channelRouteKind:
          payload.channelRouteKind ?? (payload.learningSpaceId ? 'space' : 'channel'),
        members: payload.members ?? null,
      },
      dedupeKey: `${job.dedupe_key}:activity`,
    });

    await supabase
      .from('reminder_jobs')
      .update({
        status: 'succeeded',
        dispatched_at: now,
        lease_owner: null,
        lease_until: null,
        updated_at: now,
        updated_by: systemProfileId,
        last_error: null,
      })
      .eq('id', job.id)
      .eq('org_id', job.org_id);

    await this.logDispatch({
      supabase,
      orgId: job.org_id,
      jobId: job.id,
      activityEventId: activityEvent?.id ?? null,
      result: 'succeeded',
      details: { event_type: eventType },
    });
  }
}
