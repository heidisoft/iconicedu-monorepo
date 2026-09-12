import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  ClassScheduleParticipantVM,
  ClassScheduleVM,
  ParticipantRoleVM,
  RecurrenceVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { isClassScheduleAfterArchiveCutoff } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';

import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import {
  type ExpandedClassSchedule,
  expandRecurringEvents,
  normalizeBaseScheduleId,
} from '@iconicedu/api/modules/reminders/schedule-expansion.util';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS = 8;
const SESSION_REMINDER_OFFSETS_MINUTES = [720, 15] as const;
const SESSION_COMPLETION_CHECK_OFFSET_MINUTES = 10;
const REMINDER_DELIVERY_WINDOW_START_HOUR = 9;
const REMINDER_DELIVERY_WINDOW_END_HOUR = 18;
const REMINDER_DELIVERY_WINDOW_START_TIME = '09:00';
const REMINDER_DELIVERY_WINDOW_END_TIME = '18:00';

function clampToReminderDeliveryWindow(runAt: Date, timezone: string): Date {
  const tz = timezone || 'UTC';
  const isoUtc = runAt.toISOString();
  const localTime = getLocalTime(isoUtc, tz);
  if (!localTime) return runAt;

  const hour = parseInt(localTime.split(':')[0] ?? '0', 10);
  if (
    hour >= REMINDER_DELIVERY_WINDOW_START_HOUR &&
    hour < REMINDER_DELIVERY_WINDOW_END_HOUR
  ) {
    return runAt;
  }

  const localDate = getLocalDate(isoUtc, tz);
  if (!localDate) return runAt;

  const targetTime =
    hour < REMINDER_DELIVERY_WINDOW_START_HOUR
      ? REMINDER_DELIVERY_WINDOW_START_TIME
      : REMINDER_DELIVERY_WINDOW_END_TIME;
  const clamped = toUtcFromLocal(localDate, targetTime, tz);
  return clamped ? new Date(clamped) : runAt;
}
// Wide enough to find the next occurrence without over-expanding
const RECONCILE_HORIZON_DAYS = 365;
const COMPLETION_HORIZON_DAYS = 30;

// ─── Local types (mirrors reminders.service.ts — not exported from there) ───

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
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: string;
    role?: 'educator' | 'child' | 'guardian' | 'staff' | 'observer' | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
};

type NextJobDescriptor = {
  jobType: 'session.reminder' | 'session.completion_check';
  offsetMinutes: number | null;
  occurrenceStart: string;
  occurrenceEnd: string;
  runAt: Date;
  dedupeKey: string;
  occurrence: ExpandedClassSchedule;
};

export type ReconcileAction = 'inserted' | 'kept' | 'canceled_only' | 'noop';

export type ReconcileResult = {
  action: ReconcileAction;
  dedupeKey?: string;
  dedupeKeys?: string[];
  insertedCount?: number;
  keptCount?: number;
  canceledCount?: number;
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
export class ReminderReconcileService {
  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async reconcileNextReminderJobForSchedule(input: {
    orgId: string;
    scheduleId: string;
    now?: Date;
  }): Promise<ReconcileResult> {
    const supabase = this.getSupabase();
    const now = input.now ?? new Date();

    // Load the single schedule row
    const { data: row, error: scheduleError } = await supabase
      .from('class_schedules')
      .select(CLASS_SCHEDULE_SELECT)
      .eq('org_id', input.orgId)
      .eq('id', input.scheduleId)
      .is('deleted_at', null)
      .maybeSingle<ClassScheduleRow>();

    if (scheduleError) {
      throw new InternalServerErrorException(scheduleError.message);
    }

    // Attach learning space metadata if present
    let enrichedRow = row;
    if (row?.source_learning_space_id) {
      const { data: spaceRow } = await supabase
        .from('learning_spaces')
        .select('id,status,archived_at')
        .eq('org_id', input.orgId)
        .eq('id', row.source_learning_space_id)
        .is('deleted_at', null)
        .maybeSingle<{
          id: string;
          status?: string | null;
          archived_at?: string | null;
        }>();

      enrichedRow = row ? { ...row, source_learning_space: spaceRow ?? null } : null;
    }

    const shouldCancel =
      !enrichedRow ||
      enrichedRow.status === 'cancelled' ||
      enrichedRow.status === 'completed' ||
      enrichedRow.status === 'rescheduled' ||
      enrichedRow.source_learning_space?.status === 'archived' ||
      Boolean(enrichedRow.source_learning_space?.archived_at);

    if (shouldCancel) {
      await this.cancelAllActiveJobsForSchedule(supabase, input.orgId, input.scheduleId);
      return { action: 'canceled_only' };
    }

    const schedule = this.mapClassScheduleRow(enrichedRow!);

    // Fetch succeeded dedupe keys for this schedule (idempotency)
    const { data: succeededRows, error: succeededError } = await supabase
      .from('reminder_jobs')
      .select('dedupe_key')
      .eq('org_id', input.orgId)
      .eq('source_schedule_id', input.scheduleId)
      .eq('status', 'succeeded')
      .is('deleted_at', null)
      .returns<Array<{ dedupe_key: string }>>();

    if (succeededError) {
      throw new InternalServerErrorException(succeededError.message);
    }

    const succeededDedupeKeys = new Set((succeededRows ?? []).map((r) => r.dedupe_key));

    const nextJobs = this.computeExpectedJobs(schedule, succeededDedupeKeys, now);
    const nextDedupeKeys = new Set(nextJobs.map((job) => job.dedupeKey));

    // Check current active jobs
    const { data: activeRows, error: activeError } = await supabase
      .from('reminder_jobs')
      .select('id, dedupe_key')
      .eq('org_id', input.orgId)
      .eq('source_schedule_id', input.scheduleId)
      .not('status', 'in', '("succeeded","canceled","dead_letter")')
      .is('deleted_at', null)
      .returns<Array<{ id: string; dedupe_key: string }>>();

    if (activeError) {
      throw new InternalServerErrorException(activeError.message);
    }

    const activeJobs = activeRows ?? [];
    const activeJobsByDedupe = new Map(activeJobs.map((job) => [job.dedupe_key, job]));
    const staleActiveJobs = activeJobs.filter(
      (job) => !nextDedupeKeys.has(job.dedupe_key),
    );

    // Cancel stale active jobs before inserting the correct set.
    for (const activeJob of staleActiveJobs) {
      const { error: cancelError } = await supabase
        .from('reminder_jobs')
        .update({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeJob.id)
        .eq('org_id', input.orgId);

      if (cancelError) {
        throw new InternalServerErrorException(cancelError.message);
      }
    }

    if (!nextJobs.length) {
      return staleActiveJobs.length
        ? { action: 'canceled_only', canceledCount: staleActiveJobs.length }
        : { action: 'noop' };
    }

    let insertedCount = 0;
    let keptCount = 0;

    for (const next of nextJobs) {
      if (activeJobsByDedupe.has(next.dedupeKey)) {
        keptCount += 1;
        continue;
      }

      const row2 = this.buildJobRow(input.orgId, input.scheduleId, next);
      const { data: existingDedupeJob, error: existingDedupeError } = await supabase
        .from('reminder_jobs')
        .select('id, status')
        .eq('org_id', input.orgId)
        .eq('dedupe_key', next.dedupeKey)
        .is('deleted_at', null)
        .maybeSingle<{ id: string; status: string }>();

      if (existingDedupeError) {
        throw new InternalServerErrorException(existingDedupeError.message);
      }

      if (existingDedupeJob) {
        if (existingDedupeJob.status === 'succeeded') {
          keptCount += 1;
          continue;
        }

        const { error: reactivateError } = await supabase
          .from('reminder_jobs')
          .update(row2)
          .eq('id', existingDedupeJob.id)
          .eq('org_id', input.orgId);

        if (reactivateError) {
          throw new InternalServerErrorException(reactivateError.message);
        }

        insertedCount += 1;
        continue;
      }

      const { error: insertError } = await supabase.from('reminder_jobs').insert(row2);

      if (insertError) {
        if (insertError.code === '23505') {
          keptCount += 1;
          continue;
        }
        throw new InternalServerErrorException(insertError.message);
      }

      insertedCount += 1;
    }

    const dedupeKeys = nextJobs.map((job) => job.dedupeKey);
    return {
      action: insertedCount > 0 ? 'inserted' : 'kept',
      dedupeKey: dedupeKeys[0],
      dedupeKeys,
      insertedCount,
      keptCount,
      canceledCount: staleActiveJobs.length,
    };
  }

  async reconcileAllSchedulesForLearningSpace(
    orgId: string,
    learningSpaceId: string,
  ): Promise<{ reconciledCount: number; canceledCount: number }> {
    const supabase = this.getSupabase();

    const { data: rows, error } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('org_id', orgId)
      .eq('source_kind', 'class_session')
      .eq('source_learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const scheduleIds = new Set((rows ?? []).map((r) => r.id));

    // Cancel orphaned active jobs for schedules no longer in this space
    const { data: orphanedRows, error: orphanError } = await supabase
      .from('reminder_jobs')
      .select('id, source_schedule_id')
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .not('status', 'in', '("succeeded","canceled","dead_letter")')
      .is('deleted_at', null)
      .returns<Array<{ id: string; source_schedule_id: string | null }>>();

    if (orphanError) {
      throw new InternalServerErrorException(orphanError.message);
    }

    const orphanedIds = (orphanedRows ?? [])
      .filter((r) => r.source_schedule_id && !scheduleIds.has(r.source_schedule_id))
      .map((r) => r.id);

    let canceledCount = orphanedIds.length;

    if (orphanedIds.length) {
      const { error: cancelError } = await supabase
        .from('reminder_jobs')
        .update({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .in('id', orphanedIds);

      if (cancelError) {
        throw new InternalServerErrorException(cancelError.message);
      }
    }

    let reconciledCount = 0;
    for (const scheduleId of scheduleIds) {
      const result = await this.reconcileNextReminderJobForSchedule({
        orgId,
        scheduleId,
      });
      if (result.action === 'inserted' || result.action === 'kept') {
        reconciledCount += 1;
      }
      if (result.action === 'canceled_only') {
        canceledCount += 1;
      }
    }

    return { reconciledCount, canceledCount };
  }

  async resetAndReconcileOrgReminderJobs(orgId: string): Promise<{
    canceledCount: number;
    reconciledCount: number;
    scheduleCount: number;
  }> {
    const supabase = this.getSupabase();

    // Hard-delete all non-succeeded jobs so their dedupe_keys are freed for
    // re-insertion. Only 'succeeded' rows must be kept — they are idempotency
    // markers that prevent re-dispatching already-sent reminders. Any other
    // status (pending, leased, failed, canceled, dead_letter) blocks the
    // reconciler from re-inserting the same upcoming occurrence.
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

    const canceledCount = (deletedRows ?? []).length;

    const { data: scheduleRows, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('org_id', orgId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (scheduleError) {
      throw new InternalServerErrorException(scheduleError.message);
    }

    const scheduleIds = (scheduleRows ?? []).map((r) => r.id);
    let reconciledCount = 0;

    for (const scheduleId of scheduleIds) {
      const result = await this.reconcileNextReminderJobForSchedule({
        orgId,
        scheduleId,
      });
      if (result.action === 'inserted' || result.action === 'kept') {
        reconciledCount += 1;
      }
    }

    return { canceledCount, reconciledCount, scheduleCount: scheduleIds.length };
  }

  /**
   * Periodic safety net for the dedicated schedule-reconciliation worker.
   *
   * Schedule writes enqueue a deduped `reminder.reconcile` job via DB triggers,
   * and each run materializes a rolling completion window. A schedule left
   * unedited for weeks can still drift out of that window, and a lost trigger
   * event would leave jobs missing entirely. This asks the database for a bounded
   * set of eligible schedules in that state and re-enqueues their reconcile job
   * onto this worker's own queue — it never claims or dispatches directly.
   */
  async repairStaleScheduleReconciliation(input: {
    supabase?: SupabaseServiceClient;
    limit?: number;
  }): Promise<{ requeued: number }> {
    const supabase = input.supabase ?? this.getSupabase();
    const { data, error } = await supabase.rpc('enqueue_stale_schedule_reconciliation', {
      p_limit: input.limit ?? 25,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { requeued: typeof data === 'number' ? data : Number(data ?? 0) };
  }

  // ─── Job computation ───────────────────────────────────────────────────────

  private computeExpectedJobs(
    schedule: ClassScheduleVM,
    succeededDedupeKeys: Set<string>,
    now: Date,
  ): NextJobDescriptor[] {
    if (schedule.source.kind !== 'class_session' || !schedule.source.channelId) {
      return [];
    }

    const rangeStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(
      now.getTime() + RECONCILE_HORIZON_DAYS * 24 * 60 * 60 * 1000,
    );

    const occurrences = expandRecurringEvents([schedule], rangeStart, rangeEnd)
      .filter(
        (occ) => occ.status !== 'cancelled' && !isClassScheduleAfterArchiveCutoff(occ),
      )
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const jobs: NextJobDescriptor[] = [];
    const completionHorizon =
      now.getTime() + COMPLETION_HORIZON_DAYS * 24 * 60 * 60 * 1000;
    let hasReminderOccurrence = false;
    for (const occ of occurrences) {
      if (occ.source.kind !== 'class_session' || !occ.source.channelId) continue;

      const occurrenceStart = new Date(occ.startAt);
      if (Number.isNaN(occurrenceStart.getTime())) continue;

      const occurrenceEnd = new Date(occ.endAt);
      const feedbackBase = Number.isNaN(occurrenceEnd.getTime())
        ? occurrenceStart
        : occurrenceEnd;

      const channelId = occ.source.channelId;
      const learningSpaceId = occ.source.learningSpaceId;
      const occurrenceStartIso = occ.startAt;

      const reminderJobs: NextJobDescriptor[] = [];
      for (const [index, offsetMinutes] of SESSION_REMINDER_OFFSETS_MINUTES.entries()) {
        if (hasReminderOccurrence) break;
        let runAt = new Date(occurrenceStart.getTime() - offsetMinutes * 60 * 1000);
        if (offsetMinutes === 720) {
          runAt = clampToReminderDeliveryWindow(runAt, occ.timezone ?? 'UTC');
        }
        const isFinalReminderOffset =
          index === SESSION_REMINDER_OFFSETS_MINUTES.length - 1;
        if (runAt.getTime() <= now.getTime()) {
          if (!isFinalReminderOffset || occurrenceStart.getTime() <= now.getTime()) {
            continue;
          }
          runAt = now;
        }
        if (this.isJobRunAfterArchiveCutoff(occ, runAt)) continue;

        const dedupeKey = this.buildSessionReminderDedupeKey({
          orgId: occ.ids.orgId,
          learningSpaceId,
          channelId,
          occurrenceStart: occurrenceStartIso,
          offsetMinutes,
        });

        if (succeededDedupeKeys.has(dedupeKey)) continue;

        reminderJobs.push({
          jobType: 'session.reminder',
          offsetMinutes,
          occurrenceStart: occurrenceStartIso,
          occurrenceEnd: occ.endAt,
          runAt,
          dedupeKey,
          occurrence: occ,
        });
      }

      if (reminderJobs.length) {
        jobs.push(...reminderJobs);
        hasReminderOccurrence = true;
      }

      // Enqueue completion independently, even while pre-class reminders are pending.
      // Materialize a rolling window so one failed occurrence cannot block the next.
      if (occurrenceStart.getTime() > completionHorizon) continue;
      let completionCheckRunAt = new Date(
        feedbackBase.getTime() + SESSION_COMPLETION_CHECK_OFFSET_MINUTES * 60 * 1000,
      );
      if (
        !Number.isNaN(completionCheckRunAt.getTime()) &&
        !this.isJobRunAfterArchiveCutoff(occ, completionCheckRunAt)
      ) {
        if (completionCheckRunAt.getTime() <= now.getTime()) {
          completionCheckRunAt = now;
        }

        const dedupeKey = this.buildSessionCompletionCheckDedupeKey({
          orgId: occ.ids.orgId,
          learningSpaceId,
          channelId,
          occurrenceStart: occurrenceStartIso,
        });

        if (!succeededDedupeKeys.has(dedupeKey)) {
          jobs.push({
            jobType: 'session.completion_check',
            offsetMinutes: null,
            occurrenceStart: occurrenceStartIso,
            occurrenceEnd: occ.endAt,
            runAt: completionCheckRunAt,
            dedupeKey,
            occurrence: occ,
          });
        }
      }
    }

    return jobs;
  }

  private buildJobRow(
    orgId: string,
    scheduleId: string,
    next: NextJobDescriptor,
  ): Record<string, unknown> {
    const occ = next.occurrence;
    if (occ.source.kind !== 'class_session' || !occ.source.channelId) {
      throw new Error('Cannot build job row: occurrence missing channel');
    }

    const normalizedScheduleId = normalizeBaseScheduleId(occ.ids.id);
    const now = new Date().toISOString();

    const basePayload: ReminderJobPayload = {
      title: occ.title,
      description: occ.description ?? null,
      timezone: occ.timezone ?? 'UTC',
      channelId: occ.source.channelId,
      learningSpaceId: occ.source.learningSpaceId,
      scheduleId: normalizedScheduleId,
      occurrenceStart: next.occurrenceStart,
      startAt: next.occurrenceStart,
      endAt: next.occurrenceEnd,
      location: occ.location ?? null,
      meetingLink: occ.meetingLink ?? null,
      channelRouteKind: 'space',
      members: occ.participants.map((p) => ({
        profileId: p.ids.id,
        role: p.role,
        displayName: p.displayName ?? null,
        avatarUrl: p.avatarUrl ?? null,
        themeKey: p.themeKey ?? null,
      })),
    };

    const payload: ReminderJobPayload =
      next.jobType === 'session.reminder'
        ? {
            ...basePayload,
            summary: this.formatStartsInSummary(next.offsetMinutes ?? 0),
            reminderOffsetMinutes: next.offsetMinutes,
          }
        : {
            ...basePayload,
            summary: 'How was your class?',
          };

    return {
      org_id: orgId,
      job_type: next.jobType,
      target_kind: 'channel',
      target_id: occ.source.channelId,
      source_learning_space_id: occ.source.learningSpaceId ?? null,
      source_schedule_id: scheduleId,
      occurrence_start_at: next.occurrenceStart,
      run_at: next.runAt.toISOString(),
      timezone: occ.timezone ?? 'UTC',
      payload,
      dedupe_key: next.dedupeKey,
      status: 'pending',
      max_attempts: DEFAULT_MAX_ATTEMPTS,
      attempt_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async cancelAllActiveJobsForSchedule(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleId: string,
  ) {
    const { error } = await supabase
      .from('reminder_jobs')
      .update({
        status: 'canceled',
        lease_owner: null,
        lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('source_schedule_id', scheduleId)
      .not('status', 'in', '("succeeded","canceled","dead_letter")')
      .is('deleted_at', null);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
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
        ? recurrence.exceptions.map((e) => ({
            occurrenceKey: e.occurrence_key,
            reason: e.reason ?? undefined,
          }))
        : undefined,
      overrides: recurrence.overrides?.length
        ? recurrence.overrides.map((o) => ({
            occurrenceKey: o.occurrence_key,
            patch: o.patch as RecurrenceVM['overrides'] extends Array<infer T>
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
}
