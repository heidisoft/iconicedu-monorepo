import { Injectable } from '@nestjs/common';
import type { FeedScopeVM, ReminderJobRow } from '@iconicedu/shared-types';
import { projectActivityEvents } from '@iconicedu/web/lib/activity-feed/projector/project-activity-events';
import { randomUUID } from 'crypto';

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
};

@Injectable()
export class RemindersService {
  private readonly supabase = createSupabaseServiceClient();

  async dispatchDueReminderJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const runId = randomUUID();
    const startedAt = Date.now();

    const claimResponse = await this.supabase.rpc('claim_due_reminder_jobs', {
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
        await this.processReminderJob(job);
        succeeded += 1;
      } catch (error) {
        const now = new Date();
        const nextAttemptAt = new Date(
          now.getTime() + this.resolveRetryDelayMs(job.attempt_count + 1),
        ).toISOString();
        const retryable =
          this.isRetryableError(error) && job.attempt_count + 1 < job.max_attempts;
        const nextStatus = retryable ? 'failed' : 'dead_letter';
        const message = error instanceof Error ? error.message : String(error);

        const response = await this.supabase
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
          supabase: this.supabase,
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

  private buildReminderText(payload: ReminderJobPayload) {
    if (payload.summary?.trim()) {
      return payload.summary.trim();
    }
    return `${payload.title} is starting soon.`;
  }

  private buildFeedbackPrompt(payload: ReminderJobPayload) {
    if (payload.summary?.trim()) {
      return payload.summary.trim();
    }
    return `How was "${payload.title}"?`;
  }

  private buildPaymentText(payload: ReminderJobPayload) {
    const amount =
      typeof payload.amount === 'number'
        ? `${payload.currency ?? 'USD'} ${payload.amount.toFixed(2)}`
        : null;
    if (amount && payload.dueAt) {
      return `Payment reminder: ${amount} due ${new Date(payload.dueAt).toLocaleString('en-US')}.`;
    }
    if (amount) {
      return `Payment reminder: ${amount} is due.`;
    }
    return payload.summary?.trim() || 'Payment reminder';
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

  private async ensureSystemProfileId(orgId: string): Promise<string> {
    const existing = await this.supabase
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
    const accountResponse = await this.supabase
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

    const profileResponse = await this.supabase
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

  private async publishActivityEvent(input: {
    orgId: string;
    eventType: string;
    sourceKind: 'system' | 'profile';
    actorProfileId: string;
    scope: FeedScopeVM;
    objectRef: { kind: 'message'; id: string };
    targetRef?: { kind: 'learning_space'; id: string };
    payload: Record<string, unknown>;
    dedupeKey: string;
    occurredAt: string;
  }) {
    const now = new Date().toISOString();
    const insertResponse = await this.supabase
      .from('activity_events')
      .insert({
        org_id: input.orgId,
        event_type: input.eventType,
        occurred_at: input.occurredAt,
        source_kind: input.sourceKind,
        actor_profile_id: input.actorProfileId,
        scope: input.scope,
        object_ref: input.objectRef,
        target_ref: input.targetRef ?? null,
        payload: input.payload,
        audience_rules: [],
        dedupe_key: input.dedupeKey,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: now,
        updated_at: now,
        created_by: input.actorProfileId,
        updated_by: input.actorProfileId,
      })
      .select('id')
      .single<{ id: string }>();

    if (insertResponse.error) {
      if (insertResponse.error.code === '23505') {
        const existing = await this.supabase
          .from('activity_events')
          .select('id')
          .eq('org_id', input.orgId)
          .eq('dedupe_key', input.dedupeKey)
          .is('deleted_at', null)
          .maybeSingle<{ id: string }>();

        if (existing.error) {
          throw new Error(existing.error.message);
        }
        if (existing.data) {
          return existing.data;
        }
      }
      throw new Error(insertResponse.error.message);
    }

    // Reuse existing projector implementation during transition.
    await projectActivityEvents(this.supabase as never, {
      eventIds: [insertResponse.data.id],
      limit: 1,
    });

    return insertResponse.data;
  }

  private async logDispatch(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    jobId: string;
    messageId?: string | null;
    activityEventId?: string | null;
    result: 'succeeded' | 'idempotent_hit' | 'retryable_failure' | 'fatal_failure';
    details?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const response = await input.supabase.from('reminder_dispatch_logs').insert({
      org_id: input.orgId,
      reminder_job_id: input.jobId,
      message_id: input.messageId ?? null,
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

  private async processReminderJob(job: ReminderJobRow) {
    const payload = (job.payload ?? {}) as ReminderJobPayload;
    const now = new Date().toISOString();

    const systemProfileId = await this.ensureSystemProfileId(job.org_id);
    const messageType =
      job.job_type === 'payment.reminder'
        ? 'payment-reminder'
        : job.job_type === 'session.feedback_request'
          ? 'feedback-request'
          : 'event-reminder';

    const messageInsert = await this.supabase
      .from('messages')
      .insert({
        org_id: job.org_id,
        channel_id: job.target_id,
        sender_profile_id: systemProfileId,
        type: messageType,
        visibility_type: 'all',
        created_at: now,
        updated_at: now,
        created_by: systemProfileId,
        updated_by: systemProfileId,
      })
      .select('id')
      .single<{ id: string }>();

    if (messageInsert.error) {
      throw new Error(messageInsert.error.message);
    }

    const messageId = messageInsert.data.id;
    const payloadTable =
      job.job_type === 'payment.reminder'
        ? 'message_payment_reminder'
        : job.job_type === 'session.feedback_request'
          ? 'message_feedback_request'
          : 'message_event_reminder';

    const payloadBody =
      job.job_type === 'session.feedback_request'
        ? {
            prompt: this.buildFeedbackPrompt(payload),
            text: this.buildFeedbackPrompt(payload),
            sessionTitle: payload.title,
          }
        : job.job_type === 'payment.reminder'
          ? {
              text: this.buildPaymentText(payload),
              amount: payload.amount ?? null,
              currency: payload.currency ?? 'USD',
              dueAt: payload.dueAt ?? null,
              status: 'pending',
              invoiceId: payload.invoiceId ?? null,
              description: payload.summary ?? null,
            }
          : {
              text: this.buildReminderText(payload),
              status: 'scheduled',
              title: payload.title,
              startAt: payload.startAt ?? payload.occurrenceStart ?? now,
              endAt: payload.endAt ?? null,
              location: payload.location ?? null,
              meetingLink: payload.meetingLink ?? null,
            };

    const payloadInsert = await this.supabase.from(payloadTable).insert({
      message_id: messageId,
      org_id: job.org_id,
      payload: payloadBody,
      created_at: now,
      updated_at: now,
      created_by: systemProfileId,
      updated_by: systemProfileId,
    });

    if (payloadInsert.error) {
      throw new Error(payloadInsert.error.message);
    }

    const eventType =
      job.job_type === 'payment.reminder'
        ? 'payment.reminder.sent'
        : job.job_type === 'session.feedback_request'
          ? 'session.feedback_request.sent'
          : 'session.reminder.sent';

    const scope: FeedScopeVM = payload.learningSpaceId
      ? { kind: 'learning_space', learningSpaceId: payload.learningSpaceId }
      : { kind: 'channel', channelId: payload.channelId };

    const activityEvent = await this.publishActivityEvent({
      orgId: job.org_id,
      eventType,
      occurredAt: now,
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope,
      objectRef: { kind: 'message', id: messageId },
      targetRef: payload.learningSpaceId
        ? { kind: 'learning_space', id: payload.learningSpaceId }
        : undefined,
      payload: {
        channelId: payload.channelId,
        messageId,
        learningSpaceId: payload.learningSpaceId ?? null,
        scheduleId: payload.scheduleId ?? null,
        occurrenceStart: payload.occurrenceStart ?? payload.startAt ?? now,
        invoiceId: payload.invoiceId ?? null,
        dueAt: payload.dueAt ?? null,
        title: payload.title,
        summary: payload.summary ?? null,
        channelRouteKind:
          payload.channelRouteKind ?? (payload.learningSpaceId ? 'space' : 'channel'),
      },
      dedupeKey: `${job.dedupe_key}:activity`,
    });

    await this.supabase
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
      supabase: this.supabase,
      orgId: job.org_id,
      jobId: job.id,
      messageId,
      activityEventId: activityEvent.id,
      result: 'succeeded',
      details: {
        event_type: eventType,
        payload_table: payloadTable,
      },
    });
  }
}
