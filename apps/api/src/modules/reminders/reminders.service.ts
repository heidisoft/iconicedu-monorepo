import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ClassScheduleParticipantVM,
  ClassScheduleVM,
  FeedScopeVM,
  ParticipantRoleVM,
  RecurrenceVM,
  ReminderJobRow,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { isClassScheduleAfterArchiveCutoff } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { getRequestContext } from '@iconicedu/api/observability/request-context';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { CompletionCheckDispatcherService } from '@iconicedu/api/modules/reminders/completion-check-dispatcher.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

const REMINDER_HORIZON_DAYS = 30;
const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;
const SESSION_REMINDER_OFFSETS_MINUTES = [720, 30] as const;
const SESSION_COMPLETION_CHECK_OFFSET_MINUTES = 10;

function resolveSupabaseHost() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return 'missing';
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return 'invalid';
  }
}

type ReminderJobPayload = {
  title: string;
  summary?: string | null;
  description?: string | null;
  reminderOffsetMinutes?: number | null;
  timezone?: string | null;
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

type ClassScheduleRow = {
  id: string;
  org_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  start_at: string;
  end_at: string;
  timezone?: string | null;
  status: string;
  visibility?: string | null;
  theme_key?: string | null;
  source_kind: string;
  source_learning_space_id?: string | null;
  source_channel_id?: string | null;
  source_session_id?: string | null;
  source_owner_user_id?: string | null;
  source_created_by_user_id?: string | null;
  source_related_learning_space_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  source_learning_space?: {
    status?: string | null;
    archived_at?: string | null;
  } | null;
  participants?: Array<{
    id?: string;
    org_id: string;
    profile_id: string;
    role: string;
    status?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    theme_key?: string | null;
  }> | null;
  recurrence?:
    | Array<{
        id: string;
        org_id: string;
        frequency: string;
        interval?: number | null;
        count?: number | null;
        until?: string | null;
        timezone?: string | null;
        byday?: string[] | null;
        exceptions?: Array<{
          id: string;
          occurrence_key: string;
          reason?: string | null;
        }>;
        overrides?: Array<{
          id: string;
          occurrence_key: string;
          patch?: Record<string, unknown> | null;
        }>;
      }>
    | {
        id: string;
        org_id: string;
        frequency: string;
        interval?: number | null;
        count?: number | null;
        until?: string | null;
        timezone?: string | null;
        byday?: string[] | null;
        exceptions?: Array<{
          id: string;
          occurrence_key: string;
          reason?: string | null;
        }>;
        overrides?: Array<{
          id: string;
          occurrence_key: string;
          patch?: Record<string, unknown> | null;
        }>;
      }
    | null;
};

type ExpandedClassSchedule = ClassScheduleVM & {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

const CLASS_SCHEDULE_SELECT = `
  id, org_id, title, description, location, meeting_link,
  start_at, end_at, timezone, status, visibility, theme_key,
  source_kind, source_learning_space_id, source_channel_id,
  source_session_id, source_owner_user_id, source_created_by_user_id,
  source_related_learning_space_id,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by,
  participants:class_schedule_participants(
    id, org_id, profile_id, role, status, display_name, avatar_url, theme_key
  ),
  recurrence:class_schedule_recurrence(
    id, org_id, frequency, interval, count, until, timezone, byday,
    exceptions:class_schedule_recurrence_exceptions(id, occurrence_key, reason),
    overrides:class_schedule_recurrence_overrides(id, occurrence_key, patch)
  )
`;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly reminderReconcileService: ReminderReconcileService,
    private readonly completionCheckDispatcher: CompletionCheckDispatcherService,
  ) {}

  /**
   * Keep Supabase env validation out of Nest bootstrap so the API can expose
   * health and startup errors cleanly before reminder jobs are invoked.
   */
  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  async compileLearningSpaceReminderJobs(
    accessToken: string,
    input: { orgId: string; learningSpaceId: string },
  ) {
    await this.requireOrgActor(accessToken, input.orgId);
    return this.compileLearningSpaceReminderJobsForOrg(input);
  }

  private async compileLearningSpaceReminderJobsForOrg(input: {
    orgId: string;
    learningSpaceId: string;
    supabase?: SupabaseServiceClient;
  }) {
    const supabase = input.supabase ?? this.getSupabase();
    const schedules = await this.buildClassSchedulesByOrg(supabase, input.orgId);
    const relevant = schedules.filter(
      (schedule) =>
        schedule.source.kind === 'class_session' &&
        schedule.source.learningSpaceId === input.learningSpaceId,
    );

    const now = new Date();
    const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(
      now.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000,
    );
    const occurrences = this.expandRecurringEvents(relevant, rangeStart, rangeEnd).filter(
      (schedule) =>
        schedule.status !== 'cancelled' && !isClassScheduleAfterArchiveCutoff(schedule),
    );

    const dedupeKeys = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    const createdAt = new Date().toISOString();

    for (const occurrence of occurrences) {
      if (occurrence.source.kind !== 'class_session' || !occurrence.source.channelId) {
        continue;
      }

      const occurrenceStart = new Date(occurrence.startAt);
      if (Number.isNaN(occurrenceStart.getTime())) {
        continue;
      }
      const occurrenceEnd = new Date(occurrence.endAt);
      const feedbackBaseTime = Number.isNaN(occurrenceEnd.getTime())
        ? occurrenceStart
        : occurrenceEnd;
      const normalizedScheduleId = this.normalizeBaseScheduleId(occurrence.ids.id);
      const payload: ReminderJobPayload = {
        title: occurrence.title,
        summary: occurrence.description ?? null,
        description: occurrence.description ?? null,
        timezone: occurrence.timezone ?? 'UTC',
        channelId: occurrence.source.channelId,
        learningSpaceId: occurrence.source.learningSpaceId,
        scheduleId: normalizedScheduleId,
        occurrenceStart: occurrence.startAt,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        location: occurrence.location ?? null,
        meetingLink: occurrence.meetingLink ?? null,
        channelRouteKind: 'space',
        members: occurrence.participants.map((participant) => ({
          profileId: participant.ids.id,
          role: participant.role,
          displayName: participant.displayName ?? null,
          avatarUrl: participant.avatarUrl ?? null,
          themeKey: participant.themeKey ?? null,
        })),
      };

      for (const offsetMinutes of SESSION_REMINDER_OFFSETS_MINUTES) {
        const reminderRunAt = new Date(
          occurrenceStart.getTime() - offsetMinutes * 60 * 1000,
        );
        if (reminderRunAt.getTime() <= now.getTime()) {
          continue;
        }
        if (this.isJobRunAfterArchiveCutoff(occurrence, reminderRunAt)) {
          continue;
        }
        const reminderDedupe = this.buildSessionReminderDedupeKey({
          orgId: input.orgId,
          learningSpaceId: occurrence.source.learningSpaceId,
          channelId: occurrence.source.channelId,
          occurrenceStart: occurrence.startAt,
          offsetMinutes,
        });
        dedupeKeys.add(reminderDedupe);
        rows.push({
          org_id: input.orgId,
          job_type: 'session.reminder',
          target_kind: 'channel',
          target_id: occurrence.source.channelId,
          source_learning_space_id: occurrence.source.learningSpaceId,
          source_schedule_id: normalizedScheduleId,
          occurrence_start_at: occurrence.startAt,
          run_at: reminderRunAt.toISOString(),
          timezone: occurrence.timezone ?? 'UTC',
          payload: {
            ...payload,
            summary: this.formatStartsInSummary(offsetMinutes),
            reminderOffsetMinutes: offsetMinutes,
          },
          dedupe_key: reminderDedupe,
          status: 'pending',
          max_attempts: DEFAULT_MAX_ATTEMPTS,
          created_at: createdAt,
          updated_at: createdAt,
          next_attempt_at: null,
          lease_owner: null,
          lease_until: null,
          last_error: null,
          deleted_at: null,
        });
      }

      const completionCheckDedupe = this.buildSessionCompletionCheckDedupeKey({
        orgId: input.orgId,
        learningSpaceId: occurrence.source.learningSpaceId,
        channelId: occurrence.source.channelId,
        occurrenceStart: occurrence.startAt,
      });
      const completionCheckRunAt = new Date(
        feedbackBaseTime.getTime() + SESSION_COMPLETION_CHECK_OFFSET_MINUTES * 60 * 1000,
      );
      if (this.isJobRunAfterArchiveCutoff(occurrence, completionCheckRunAt)) {
        continue;
      }

      dedupeKeys.add(completionCheckDedupe);
      rows.push({
        org_id: input.orgId,
        job_type: 'session.completion_check',
        target_kind: 'channel',
        target_id: occurrence.source.channelId,
        source_learning_space_id: occurrence.source.learningSpaceId,
        source_schedule_id: normalizedScheduleId,
        occurrence_start_at: occurrence.startAt,
        run_at: completionCheckRunAt.toISOString(),
        timezone: occurrence.timezone ?? 'UTC',
        payload: { ...payload },
        dedupe_key: completionCheckDedupe,
        status: 'pending',
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        created_at: createdAt,
        updated_at: createdAt,
        next_attempt_at: null,
        lease_owner: null,
        lease_until: null,
        last_error: null,
        deleted_at: null,
      });
    }

    const dedupeKeyList = Array.from(dedupeKeys);
    const existingByDedupe = new Map<string, ReminderJobRow['status']>();
    if (dedupeKeyList.length) {
      const existingResponse = await supabase
        .from('reminder_jobs')
        .select('dedupe_key, status')
        .eq('org_id', input.orgId)
        .in('dedupe_key', dedupeKeyList)
        .is('deleted_at', null)
        .returns<Array<{ dedupe_key: string; status: ReminderJobRow['status'] }>>();

      if (existingResponse.error) {
        throw new InternalServerErrorException(existingResponse.error.message);
      }

      for (const row of existingResponse.data ?? []) {
        existingByDedupe.set(row.dedupe_key, row.status);
      }
    }

    const rowsToUpsert = rows.filter((row) => {
      const dedupeKey = typeof row.dedupe_key === 'string' ? row.dedupe_key : null;
      if (!dedupeKey) return true;
      return existingByDedupe.get(dedupeKey) !== 'succeeded';
    });

    if (rowsToUpsert.length) {
      const upsertResponse = await supabase
        .from('reminder_jobs')
        .upsert(rowsToUpsert, { onConflict: 'org_id,dedupe_key' });
      if (upsertResponse.error) {
        throw new InternalServerErrorException(upsertResponse.error.message);
      }
    }

    const staleCandidatesResponse = await supabase
      .from('reminder_jobs')
      .select('id, dedupe_key')
      .eq('org_id', input.orgId)
      .eq('source_learning_space_id', input.learningSpaceId)
      .in('job_type', ['session.reminder', 'session.completion_check'])
      .in('status', ['pending', 'leased', 'failed'])
      .is('deleted_at', null)
      .returns<Array<{ id: string; dedupe_key: string }>>();

    if (staleCandidatesResponse.error) {
      throw new InternalServerErrorException(staleCandidatesResponse.error.message);
    }

    const staleIds = (staleCandidatesResponse.data ?? [])
      .filter((row) => !dedupeKeys.has(row.dedupe_key))
      .map((row) => row.id);

    if (staleIds.length) {
      const staleUpdateResponse = await supabase
        .from('reminder_jobs')
        .update({
          status: 'canceled',
          updated_at: createdAt,
          lease_owner: null,
          lease_until: null,
        })
        .eq('org_id', input.orgId)
        .in('id', staleIds);

      if (staleUpdateResponse.error) {
        throw new InternalServerErrorException(staleUpdateResponse.error.message);
      }
    }

    return {
      compiledCount: rowsToUpsert.length,
      canceledCount: staleIds.length,
    };
  }

  async reconcileLearningSpaceReminderJobs(
    accessToken: string,
    input: { orgId: string; learningSpaceId: string },
  ) {
    await this.requireOrgActor(accessToken, input.orgId);
    return this.reminderReconcileService.reconcileAllSchedulesForLearningSpace(
      input.orgId,
      input.learningSpaceId,
    );
  }

  async reconcileLearningSpaceReminderJobsInternal(input: {
    orgId: string;
    learningSpaceId: string;
  }) {
    return this.reminderReconcileService.reconcileAllSchedulesForLearningSpace(
      input.orgId,
      input.learningSpaceId,
    );
  }

  async resetAndReconcileOrgReminderJobs(orgId: string) {
    const supabase = this.getSupabase();

    const { data: deletedRows, error: deleteError } = await supabase
      .from('reminder_jobs')
      .delete()
      .eq('org_id', orgId)
      .not('status', 'in', '("succeeded")')
      .select('id')
      .returns<Array<{ id: string }>>();

    if (deleteError) {
      throw new InternalServerErrorException(deleteError.message);
    }

    const { data: legacyFeedbackRows, error: legacyFeedbackError } = await supabase
      .from('reminder_jobs')
      .delete()
      .eq('org_id', orgId)
      .eq('job_type', 'session.feedback_request')
      .select('id')
      .returns<Array<{ id: string }>>();

    if (legacyFeedbackError) {
      throw new InternalServerErrorException(legacyFeedbackError.message);
    }

    const { data: scheduleRows, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('id, source_learning_space_id')
      .eq('org_id', orgId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .returns<Array<{ id: string; source_learning_space_id: string | null }>>();

    if (scheduleError) {
      throw new InternalServerErrorException(scheduleError.message);
    }

    const learningSpaceIds = Array.from(
      new Set(
        (scheduleRows ?? [])
          .map((row) => row.source_learning_space_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let compiledCount = 0;
    let staleCanceledCount = 0;
    for (const learningSpaceId of learningSpaceIds) {
      const result = await this.compileLearningSpaceReminderJobsForOrg({
        orgId,
        learningSpaceId,
        supabase,
      });
      compiledCount += result.compiledCount;
      staleCanceledCount += result.canceledCount;
    }

    return {
      canceledCount: (deletedRows ?? []).length,
      legacyFeedbackDeletedCount: (legacyFeedbackRows ?? []).length,
      staleCanceledCount,
      compiledCount,
      reconciledCount: learningSpaceIds.length,
      scheduleCount: (scheduleRows ?? []).length,
      learningSpaceCount: learningSpaceIds.length,
    };
  }

  async cancelLearningSpaceReminderJobs(
    accessToken: string,
    input: { orgId: string; learningSpaceId: string },
  ) {
    await this.requireOrgActor(accessToken, input.orgId);
    const response = await this.getSupabase()
      .from('reminder_jobs')
      .update({
        status: 'canceled',
        lease_owner: null,
        lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', input.orgId)
      .eq('source_learning_space_id', input.learningSpaceId)
      .in('status', ['pending', 'leased', 'failed'])
      .is('deleted_at', null);

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }

    return { success: true };
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
    let skipped = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const job of claimed) {
      const payload = (job.payload ?? {}) as ReminderJobPayload;
      try {
        const result = await this.processReminderJob(job, supabase);
        if (result === 'skipped') {
          skipped += 1;
        } else {
          succeeded += 1;
        }
      } catch (error) {
        this.analytics.capture('api reminder job failed', {
          jobId: job.id,
          orgId: job.org_id,
          jobType: job.job_type,
          attemptCount: job.attempt_count + 1,
          dedupeKey: job.dedupe_key,
          sourceScheduleId: job.source_schedule_id,
          sourceLearningSpaceId: job.source_learning_space_id,
          occurrenceStartAt: job.occurrence_start_at,
          runAt: job.run_at,
          targetKind: job.target_kind,
          targetId: job.target_id,
          payloadScheduleId: payload.scheduleId ?? null,
          payloadStartAt: payload.startAt ?? null,
          payloadOccurrenceStart: payload.occurrenceStart ?? null,
          payloadReminderOffsetMinutes: payload.reminderOffsetMinutes ?? null,
          payloadChannelId: payload.channelId ?? null,
          payloadLearningSpaceId: payload.learningSpaceId ?? null,
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
      skipped,
      failed,
      deadLettered,
      durationMs,
      leaseOwner: input.leaseOwner,
    });

    return {
      runId,
      claimed: claimed.length,
      succeeded,
      failed,
      skipped,
      deadLettered,
      durationMs,
    };
  }

  private async requireOrgActor(accessToken: string, orgId: string) {
    const requestId = getRequestContext()?.requestId;
    const supabaseHost = resolveSupabaseHost();
    this.logger.log(
      `reminders org actor lookup started ${JSON.stringify({
        requestId,
        orgId,
        supabaseHost,
        hasAccessToken: Boolean(accessToken),
      })}`,
    );

    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();

    if (userError) {
      this.logger.warn(
        `reminders org actor auth lookup failed ${JSON.stringify({
          requestId,
          orgId,
          supabaseHost,
          errorMessage: userError.message,
        })}`,
      );
      throw new UnauthorizedException(userError.message);
    }
    if (!user) {
      this.logger.warn(
        `reminders org actor auth user missing ${JSON.stringify({
          requestId,
          orgId,
          supabaseHost,
        })}`,
      );
      throw new UnauthorizedException('Unauthorized');
    }

    this.logger.log(
      `reminders org actor auth user resolved ${JSON.stringify({
        requestId,
        orgId,
        authUserId: user.id,
        supabaseHost,
      })}`,
    );

    const { data: account, error: accountError } = await this.getSupabase()
      .from('accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (accountError) {
      this.logger.warn(
        `reminders org actor account lookup failed ${JSON.stringify({
          requestId,
          orgId,
          authUserId: user.id,
          supabaseHost,
          errorMessage: accountError.message,
        })}`,
      );
      throw new InternalServerErrorException(accountError.message);
    }
    if (!account) {
      this.logger.warn(
        `reminders org actor account missing ${JSON.stringify({
          requestId,
          orgId,
          authUserId: user.id,
          supabaseHost,
          accountFound: false,
        })}`,
      );
      throw new ForbiddenException('Forbidden');
    }

    this.logger.log(
      `reminders org actor account resolved ${JSON.stringify({
        requestId,
        orgId,
        authUserId: user.id,
        accountId: account.id,
        supabaseHost,
        accountFound: true,
      })}`,
    );
  }

  private async buildClassSchedulesByOrg(
    supabase: SupabaseServiceClient,
    orgId: string,
  ): Promise<ClassScheduleVM[]> {
    const response = await supabase
      .from('class_schedules')
      .select(CLASS_SCHEDULE_SELECT)
      .eq('org_id', orgId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .order('start_at', { ascending: true })
      .returns<ClassScheduleRow[]>();

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }

    const rows = await this.attachLearningSpaceArchiveMetadata(
      supabase,
      orgId,
      response.data ?? [],
    );

    return rows.map((row) => this.mapClassScheduleRow(row));
  }

  private async attachLearningSpaceArchiveMetadata(
    supabase: SupabaseServiceClient,
    orgId: string,
    rows: ClassScheduleRow[],
  ): Promise<ClassScheduleRow[]> {
    const learningSpaceIds = Array.from(
      new Set(
        rows
          .map((row) => row.source_learning_space_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (!learningSpaceIds.length) {
      return rows;
    }

    const response = await supabase
      .from('learning_spaces')
      .select('id,status,archived_at')
      .eq('org_id', orgId)
      .in('id', learningSpaceIds)
      .returns<
        Array<{ id: string; status?: string | null; archived_at?: string | null }>
      >();

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }

    const byId = new Map((response.data ?? []).map((row) => [row.id, row]));
    return rows.map((row) => ({
      ...row,
      source_learning_space: row.source_learning_space_id
        ? (byId.get(row.source_learning_space_id) ?? null)
        : null,
    }));
  }

  private mapClassScheduleRow(row: ClassScheduleRow): ClassScheduleVM {
    return {
      ids: { id: row.id, orgId: row.org_id },
      title: row.title,
      description: row.description ?? null,
      location: row.location ?? null,
      meetingLink: row.meeting_link ?? null,
      startAt: row.start_at,
      endAt: row.end_at,
      timezone: row.timezone ?? undefined,
      status: row.status as ClassScheduleVM['status'],
      visibility: (row.visibility ?? 'private') as ClassScheduleVM['visibility'],
      themeKey: row.theme_key as ClassScheduleVM['themeKey'],
      participants: (row.participants ?? []).map((participant) => ({
        ids: { id: participant.profile_id, orgId: participant.org_id },
        role: participant.role as ParticipantRoleVM,
        status: participant.status as ClassScheduleParticipantVM['status'],
        displayName: participant.display_name ?? undefined,
        avatarUrl: participant.avatar_url ?? null,
        themeKey: participant.theme_key as ClassScheduleParticipantVM['themeKey'],
      })),
      source: {
        kind: 'class_session',
        learningSpaceId: row.source_learning_space_id ?? '',
        channelId: row.source_channel_id ?? undefined,
        sessionId: row.source_session_id ?? undefined,
        archivedAt: row.source_learning_space?.archived_at ?? null,
        learningSpaceStatus: row.source_learning_space?.status ?? null,
      },
      recurrence: this.mapRecurrence(row.recurrence),
      audit: {
        createdAt: row.created_at ?? row.start_at,
        createdBy: row.created_by ?? '',
        updatedAt: row.updated_at ?? undefined,
        updatedBy: row.updated_by ?? undefined,
        deletedAt: row.deleted_at ?? undefined,
        deletedBy: row.deleted_by ?? undefined,
      },
    };
  }

  private mapRecurrence(row: ClassScheduleRow['recurrence']): RecurrenceVM | undefined {
    const recurrence = Array.isArray(row) ? row[0] : row;
    if (!recurrence) return undefined;
    return {
      ids: { id: recurrence.id, orgId: recurrence.org_id },
      rule: {
        frequency: recurrence.frequency as RecurrenceVM['rule']['frequency'],
        interval: recurrence.interval ?? undefined,
        byWeekday: recurrence.byday?.filter(this.isWeekday) ?? undefined,
        count: recurrence.count ?? undefined,
        until: recurrence.until ?? undefined,
        timezone: recurrence.timezone ?? undefined,
      },
      exceptions: recurrence.exceptions?.length
        ? recurrence.exceptions.map((exception) => ({
            occurrenceKey: exception.occurrence_key,
            reason: exception.reason ?? undefined,
          }))
        : undefined,
      overrides: recurrence.overrides?.length
        ? recurrence.overrides.map((override) => ({
            occurrenceKey: override.occurrence_key,
            patch: override.patch as RecurrenceVM['overrides'] extends Array<infer T>
              ? T extends { patch: infer P }
                ? P
                : never
              : never,
          }))
        : undefined,
    };
  }

  private isWeekday(value: string): value is WeekdayVM {
    return ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(value);
  }

  private normalizeBaseScheduleId(scheduleId: string) {
    const marker = '__';
    const index = scheduleId.indexOf(marker);
    return index === -1 ? scheduleId : scheduleId.slice(0, index);
  }

  private isJobRunAfterArchiveCutoff(schedule: ClassScheduleVM, runAt: Date) {
    if (schedule.source.kind !== 'class_session') return false;
    const archivedAt = schedule.source.archivedAt;
    if (!archivedAt) return false;

    const archiveMs = new Date(archivedAt).getTime();
    if (!Number.isFinite(archiveMs)) return false;
    return runAt.getTime() > archiveMs;
  }

  private formatStartsInSummary(offsetMinutes: number) {
    if (offsetMinutes >= 60 && offsetMinutes % 60 === 0) {
      const hours = offsetMinutes / 60;
      return `Class starts in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `Class starts in ${offsetMinutes} minutes`;
  }

  private buildSessionReminderDedupeKey(input: {
    orgId: string;
    learningSpaceId?: string | null;
    channelId: string;
    occurrenceStart: string;
    offsetMinutes: number;
  }) {
    const learningSpaceId = input.learningSpaceId ?? 'unknown-space';
    return `session.reminder:${input.orgId}:${learningSpaceId}:${input.channelId}:${input.occurrenceStart}:${input.offsetMinutes}`;
  }

  private buildSessionCompletionCheckDedupeKey(input: {
    orgId: string;
    learningSpaceId?: string | null;
    channelId: string;
    occurrenceStart: string;
  }) {
    const learningSpaceId = input.learningSpaceId ?? 'unknown-space';
    return `session.completion_check:${input.orgId}:${learningSpaceId}:${input.channelId}:${input.occurrenceStart}`;
  }

  private getScheduleTimezone(event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>) {
    return event.timezone ?? event.recurrence?.rule.timezone ?? 'UTC';
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private parseDateKey(value: string) {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number.parseInt(yearText ?? '1970', 10);
    const month = Number.parseInt(monthText ?? '1', 10);
    const day = Number.parseInt(dayText ?? '1', 10);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  }

  private getDateDiffInDays(left: string, right: string) {
    return Math.round(
      (this.parseDateKey(left).getTime() - this.parseDateKey(right).getTime()) /
        (24 * 60 * 60 * 1000),
    );
  }

  private getWeekdayTokenFromDateKey(value: string): WeekdayVM {
    const weekday = this.parseDateKey(value).getUTCDay();
    return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][weekday] as WeekdayVM;
  }

  private getScheduleLocalDayKey(
    isoDateTime: string,
    event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
  ) {
    return (
      getLocalDate(isoDateTime, this.getScheduleTimezone(event)) ??
      isoDateTime.slice(0, 10)
    );
  }

  private isWithinRange(date: Date, rangeStart: Date, rangeEnd: Date) {
    const day = this.startOfDay(date).getTime();
    return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
  }

  private getMinDate(dates: Date[]) {
    return dates.reduce((min, current) => (current < min ? current : min), dates[0]!);
  }

  private getMaxDate(dates: Date[]) {
    return dates.reduce((max, current) => (current > max ? current : max), dates[0]!);
  }

  private getDisplaySchedulePriority(schedule: ExpandedClassSchedule) {
    if (schedule.uiState?.kind === 'exception') return 3;
    if (schedule.uiState?.kind === 'override') return 2;
    return 1;
  }

  private getDisplayScheduleOccurrenceIdentity(schedule: ExpandedClassSchedule) {
    const baseId = this.normalizeBaseScheduleId(schedule.ids.id);
    const originalStartAt = schedule.uiState?.originalStartAt;
    if (originalStartAt) {
      return `${baseId}|${originalStartAt}`;
    }
    const separatorIndex = schedule.ids.id.indexOf('__');
    if (separatorIndex !== -1) {
      const [, occurrenceKey = schedule.startAt] = schedule.ids.id.split('__');
      return `${baseId}|${occurrenceKey}`;
    }
    return `${baseId}|${schedule.startAt}`;
  }

  private dedupeExpandedEvents(schedules: ExpandedClassSchedule[]) {
    const deduped = new Map<string, ExpandedClassSchedule>();
    schedules.forEach((schedule) => {
      const key = this.getDisplayScheduleOccurrenceIdentity(schedule);
      const existing = deduped.get(key);
      if (
        !existing ||
        this.getDisplaySchedulePriority(schedule) >
          this.getDisplaySchedulePriority(existing)
      ) {
        deduped.set(key, schedule);
      }
    });
    return Array.from(deduped.values());
  }

  private expandRecurringEvents(
    events: ClassScheduleVM[],
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    const expanded: ExpandedClassSchedule[] = [];
    const rangeStartDay = this.startOfDay(rangeStart);
    const rangeEndDay = this.startOfDay(rangeEnd);

    events.forEach((event) => {
      if (!event.recurrence) {
        const eventDate = this.startOfDay(new Date(event.startAt));
        if (this.isWithinRange(eventDate, rangeStartDay, rangeEndDay)) {
          const isCancelled = event.status === 'cancelled';
          expanded.push({
            ...event,
            meetingLink: isCancelled ? null : event.meetingLink,
            uiState: isCancelled
              ? {
                  kind: 'exception',
                  disabled: true,
                  reason: event.description ?? null,
                  originalStartAt: event.startAt,
                  originalEndAt: event.endAt,
                }
              : { kind: 'default' },
          });
        }
        return;
      }

      const recurrence = event.recurrence;
      const rule = recurrence.rule;
      const interval = rule.interval ?? 1;
      const scheduleTimezone = this.getScheduleTimezone(event);
      const baseStart = new Date(event.startAt);
      const baseLocalDate =
        getLocalDate(event.startAt, scheduleTimezone) ?? event.startAt.slice(0, 10);
      const baseLocalTime = getLocalTime(event.startAt, scheduleTimezone) ?? '00:00';
      const durationMs = new Date(event.endAt).getTime() - baseStart.getTime();
      const exceptions = new Set(
        recurrence.exceptions?.map((exception) => exception.occurrenceKey) ?? [],
      );
      const exceptionsByDay = new Set(
        recurrence.exceptions?.map((exception) =>
          this.getScheduleLocalDayKey(exception.occurrenceKey, event),
        ) ?? [],
      );
      const overrides = new Map(
        recurrence.overrides?.map((override) => [
          override.occurrenceKey,
          override.patch,
        ]) ?? [],
      );
      const overridesByDay = new Map(
        recurrence.overrides?.map((override) => [
          this.getScheduleLocalDayKey(override.occurrenceKey, event),
          override.patch,
        ]) ?? [],
      );
      const byWeekday = rule.byWeekday?.length
        ? rule.byWeekday
        : [this.getWeekdayTokenFromDateKey(baseLocalDate)];
      const overrideOriginalDates =
        recurrence.overrides?.map((override) =>
          this.getScheduleLocalDayKey(override.occurrenceKey, event),
        ) ?? [];
      const overridePatchedDates =
        recurrence.overrides
          ?.map((override) =>
            override.patch.startAt
              ? this.getScheduleLocalDayKey(override.patch.startAt, event)
              : null,
          )
          .filter((date): date is string => Boolean(date)) ?? [];
      const exceptionDates =
        recurrence.exceptions?.map((exception) =>
          this.getScheduleLocalDayKey(exception.occurrenceKey, event),
        ) ?? [];
      const rangeStartLocalDate =
        getLocalDate(rangeStart.toISOString(), scheduleTimezone) ??
        this.toDateKey(rangeStartDay);
      const rangeEndLocalDate =
        getLocalDate(rangeEnd.toISOString(), scheduleTimezone) ??
        this.toDateKey(rangeEndDay);
      const iterationStart = this.getMinDate(
        [
          this.parseDateKey(baseLocalDate),
          this.parseDateKey(rangeStartLocalDate),
          ...overrideOriginalDates,
          ...exceptionDates,
        ].map((value) => (typeof value === 'string' ? this.parseDateKey(value) : value)),
      );
      const iterationEnd = this.getMaxDate(
        [
          this.parseDateKey(rangeEndLocalDate),
          ...overrideOriginalDates,
          ...overridePatchedDates,
          ...exceptionDates,
        ].map((value) => (typeof value === 'string' ? this.parseDateKey(value) : value)),
      );

      recurrence.exceptions?.forEach((exception) => {
        const originalStart = new Date(exception.occurrenceKey);
        const occurrenceDayKey = this.getScheduleLocalDayKey(
          exception.occurrenceKey,
          event,
        );
        if (
          overrides.has(exception.occurrenceKey) ||
          overridesByDay.has(occurrenceDayKey)
        )
          return;
        const originalEnd = new Date(originalStart.getTime() + durationMs);
        expanded.push({
          ...event,
          ids: {
            ...event.ids,
            id: `${event.ids.id}__${exception.occurrenceKey}__exception`,
          },
          startAt: originalStart.toISOString(),
          endAt: originalEnd.toISOString(),
          status: 'cancelled',
          meetingLink: null,
          recurrence: undefined,
          description: exception.reason ?? event.description ?? null,
          uiState: {
            kind: 'exception',
            disabled: true,
            reason: exception.reason ?? null,
            originalStartAt: originalStart.toISOString(),
            originalEndAt: originalEnd.toISOString(),
          },
        });
      });

      let occurrenceCount = 0;
      const until = rule.until
        ? (getLocalDate(rule.until, scheduleTimezone) ?? rule.until.slice(0, 10))
        : null;

      for (
        let current = iterationStart;
        current <= iterationEnd;
        current = this.addDays(current, 1)
      ) {
        const currentLocalDate = this.toDateKey(current);
        if (currentLocalDate < baseLocalDate) continue;
        if (until && currentLocalDate > until) break;

        const diffDays = this.getDateDiffInDays(currentLocalDate, baseLocalDate);
        let matches = false;
        if (rule.frequency === 'daily') {
          matches = diffDays % interval === 0;
        } else if (rule.frequency === 'weekly') {
          const weeksDiff = Math.floor(diffDays / 7);
          matches =
            weeksDiff % interval === 0 &&
            byWeekday.includes(this.getWeekdayTokenFromDateKey(currentLocalDate));
        }

        const occurrenceKey =
          toUtcFromLocal(currentLocalDate, baseLocalTime, scheduleTimezone) ??
          (() => {
            const occurrenceStart = new Date(current);
            occurrenceStart.setHours(
              baseStart.getHours(),
              baseStart.getMinutes(),
              baseStart.getSeconds(),
              baseStart.getMilliseconds(),
            );
            return occurrenceStart.toISOString();
          })();
        const occurrenceStart = new Date(occurrenceKey);
        const occurrenceDayKey = currentLocalDate;
        const override =
          overrides.get(occurrenceKey) ?? overridesByDay.get(occurrenceDayKey);
        const hasOverride = Boolean(override);

        if (!matches && !hasOverride) continue;
        if (
          (exceptions.has(occurrenceKey) || exceptionsByDay.has(occurrenceDayKey)) &&
          !hasOverride
        )
          continue;
        if (rule.count && occurrenceCount >= rule.count) break;

        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
        expanded.push({
          ...event,
          ...override,
          ids: { ...event.ids, id: `${event.ids.id}__${occurrenceKey}` },
          startAt: override?.startAt ?? occurrenceStart.toISOString(),
          endAt: override?.endAt ?? occurrenceEnd.toISOString(),
          status: override?.status ?? (hasOverride ? 'rescheduled' : event.status),
          recurrence: event.recurrence,
          uiState: hasOverride
            ? {
                kind: 'override',
                reason:
                  typeof override?.description === 'string'
                    ? override.description
                    : typeof (override as { reason?: unknown } | undefined)?.reason ===
                        'string'
                      ? ((override as { reason?: string }).reason ?? null)
                      : null,
                originalStartAt: occurrenceStart.toISOString(),
                originalEndAt: occurrenceEnd.toISOString(),
              }
            : { kind: 'default' },
        });
        occurrenceCount += 1;
      }
    });

    return this.dedupeExpandedEvents(expanded).filter((schedule) =>
      this.isWithinRange(new Date(schedule.startAt), rangeStartDay, rangeEndDay),
    );
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

  private async processReminderJob(
    job: ReminderJobRow,
    supabase: SupabaseServiceClient,
  ): Promise<'succeeded' | 'skipped'> {
    const payload = (job.payload ?? {}) as ReminderJobPayload;
    const now = new Date().toISOString();

    const systemProfileId = await this.ensureSystemProfileId(supabase, job.org_id);
    if (await this.shouldSkipReminderJobForArchivedClassroom(job, supabase, payload)) {
      const updateResponse = await supabase
        .from('reminder_jobs')
        .update({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
          updated_at: now,
          updated_by: systemProfileId,
          last_error: null,
        })
        .eq('id', job.id)
        .eq('org_id', job.org_id);

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      await this.logDispatch({
        supabase,
        orgId: job.org_id,
        jobId: job.id,
        result: 'idempotent_hit',
        details: {
          skipped_reason: 'classroom_archived',
          job_type: job.job_type,
        },
      });

      return 'skipped';
    }

    const updateResponse = await supabase
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

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }

    let activityEventId: string | null = null;

    if (job.job_type === 'session.completion_check') {
      const dispatchedIds = await this.completionCheckDispatcher.dispatchCompletionCheck({
        supabase,
        job,
        payload,
        systemProfileId,
      });
      activityEventId = dispatchedIds[0] ?? null;
    } else {
      const activityEvent = await publishActivityEvent({
        supabase,
        orgId: job.org_id,
        eventType: 'session.reminder.sent',
        sourceKind: 'system',
        actorProfileId: systemProfileId,
        scope: payload.learningSpaceId
          ? { kind: 'learning_space', learningSpaceId: payload.learningSpaceId }
          : { kind: 'channel', channelId: payload.channelId },
        objectRef: {
          kind: 'session',
          id:
            payload.scheduleId ??
            payload.occurrenceStart ??
            job.source_schedule_id ??
            job.id,
        },
        targetRef: payload.learningSpaceId
          ? { kind: 'learning_space', id: payload.learningSpaceId }
          : null,
        audienceRules: [{ kind: 'all_in_scope' }],
        payload: {
          ...payload,
          title: payload.title,
          learningSpaceTitle: payload.title,
          channelRouteKind: payload.channelRouteKind ?? 'space',
        },
        dedupeKey: `${job.dedupe_key}:activity`,
        refreshOnDedupe: true,
        createdBy: systemProfileId,
      });
      activityEventId = activityEvent?.id ?? null;
    }

    await this.logDispatch({
      supabase,
      orgId: job.org_id,
      jobId: job.id,
      activityEventId,
      result: 'succeeded',
      details: {
        activity_event_id: activityEventId,
        job_type: job.job_type,
      },
    });

    // Replenish: insert the next job in the chain for this schedule
    if (job.source_schedule_id) {
      try {
        await this.reminderReconcileService.reconcileNextReminderJobForSchedule({
          orgId: job.org_id,
          scheduleId: job.source_schedule_id,
        });
      } catch (replenishError) {
        await this.logDispatch({
          supabase,
          orgId: job.org_id,
          jobId: job.id,
          result: 'retryable_failure',
          details: {
            replenish_error:
              replenishError instanceof Error
                ? replenishError.message
                : String(replenishError),
            phase: 'replenishment',
          },
        });
        // Non-fatal: the dispatch itself succeeded
      }
    }

    return 'succeeded';
  }

  private async shouldSkipReminderJobForArchivedClassroom(
    job: ReminderJobRow,
    supabase: SupabaseServiceClient,
    payload: ReminderJobPayload,
  ) {
    const learningSpaceId = payload.learningSpaceId ?? job.source_learning_space_id;
    if (!learningSpaceId) return false;

    const response = await supabase
      .from('learning_spaces')
      .select('status, archived_at')
      .eq('org_id', job.org_id)
      .eq('id', learningSpaceId)
      .is('deleted_at', null)
      .maybeSingle<{ status: string | null; archived_at: string | null }>();

    if (response.error) {
      throw new Error(response.error.message);
    }

    const archivedAt = response.data?.archived_at ?? null;
    if (!archivedAt && response.data?.status !== 'archived') return false;
    if (!archivedAt) return true;

    const archivedMs = new Date(archivedAt).getTime();
    const runMs = new Date(job.run_at).getTime();
    const occurrenceStart = payload.occurrenceStart ?? payload.startAt;
    const occurrenceMs = occurrenceStart
      ? new Date(occurrenceStart).getTime()
      : Number.POSITIVE_INFINITY;

    return (
      !Number.isFinite(archivedMs) ||
      !Number.isFinite(runMs) ||
      !Number.isFinite(occurrenceMs) ||
      runMs > archivedMs ||
      occurrenceMs > archivedMs
    );
  }
}
