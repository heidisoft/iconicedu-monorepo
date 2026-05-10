import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  ClassScheduleParticipantVM,
  ClassScheduleVM,
  ParticipantRoleVM,
  RecurrenceVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import {
  isClassScheduleAfterArchiveCutoff,
  type EventStatusVM,
} from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';

import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS = 8;
const SESSION_REMINDER_OFFSETS_MINUTES = [30, 5] as const;
const SESSION_FEEDBACK_OFFSET_MINUTES = 15;
// Wide enough to find the next occurrence without over-expanding
const RECONCILE_HORIZON_DAYS = 365;

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

type ExpandedClassSchedule = ClassScheduleVM & {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
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
  jobType: 'session.reminder' | 'session.feedback_request';
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

    const nextJobs = this.computeExpectedJobsForNextOccurrence(
      schedule,
      succeededDedupeKeys,
      now,
    );
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

  // ─── Chain computation ───────────────────────────────────────────────────────

  private computeExpectedJobsForNextOccurrence(
    schedule: ClassScheduleVM,
    succeededDedupeKeys: Set<string>,
    now: Date,
  ): NextJobDescriptor[] {
    if (schedule.source.kind !== 'class_session' || !schedule.source.channelId) {
      return [];
    }

    const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(
      now.getTime() + RECONCILE_HORIZON_DAYS * 24 * 60 * 60 * 1000,
    );

    const occurrences = this.expandRecurringEvents([schedule], rangeStart, rangeEnd)
      .filter(
        (occ) => occ.status !== 'cancelled' && !isClassScheduleAfterArchiveCutoff(occ),
      )
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

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
        let runAt = new Date(occurrenceStart.getTime() - offsetMinutes * 60 * 1000);
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
        return reminderJobs;
      }

      // Feedback job
      const feedbackRunAt = new Date(
        feedbackBase.getTime() + SESSION_FEEDBACK_OFFSET_MINUTES * 60 * 1000,
      );
      if (
        feedbackRunAt.getTime() > now.getTime() &&
        !this.isJobRunAfterArchiveCutoff(occ, feedbackRunAt)
      ) {
        const dedupeKey = this.buildSessionFeedbackDedupeKey({
          orgId: occ.ids.orgId,
          learningSpaceId,
          channelId,
          occurrenceStart: occurrenceStartIso,
        });

        if (!succeededDedupeKeys.has(dedupeKey)) {
          return [
            {
              jobType: 'session.feedback_request',
              offsetMinutes: null,
              occurrenceStart: occurrenceStartIso,
              occurrenceEnd: occ.endAt,
              runAt: feedbackRunAt,
              dedupeKey,
              occurrence: occ,
            },
          ];
        }
      }
    }

    return [];
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

    const normalizedScheduleId = this.normalizeBaseScheduleId(occ.ids.id);
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
            summary: `Class starts in ${next.offsetMinutes} minutes`,
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

  private normalizeBaseScheduleId(scheduleId: string) {
    const index = scheduleId.indexOf('__');
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

  private buildSessionFeedbackDedupeKey(input: {
    orgId: string;
    learningSpaceId?: string | null;
    channelId: string;
    occurrenceStart: string;
  }) {
    const learningSpaceId = input.learningSpaceId ?? 'unknown-space';
    return `session.feedback_request:${input.orgId}:${learningSpaceId}:${input.channelId}:${input.occurrenceStart}`;
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
        recurrence.exceptions?.map((e) => e.occurrenceKey) ?? [],
      );
      const exceptionsByDay = new Set(
        recurrence.exceptions?.map((e) =>
          this.getScheduleLocalDayKey(e.occurrenceKey, event),
        ) ?? [],
      );
      const overrides = new Map(
        recurrence.overrides?.map((o) => [o.occurrenceKey, o.patch]) ?? [],
      );
      const overridesByDay = new Map(
        recurrence.overrides?.map((o) => [
          this.getScheduleLocalDayKey(o.occurrenceKey, event),
          o.patch,
        ]) ?? [],
      );
      const byWeekday = rule.byWeekday?.length
        ? rule.byWeekday
        : [this.getWeekdayTokenFromDateKey(baseLocalDate)];
      const overrideOriginalDates =
        recurrence.overrides?.map((o) =>
          this.getScheduleLocalDayKey(o.occurrenceKey, event),
        ) ?? [];
      const overridePatchedDates =
        recurrence.overrides
          ?.map((o) =>
            o.patch?.startAt
              ? this.getScheduleLocalDayKey(o.patch.startAt as string, event)
              : null,
          )
          .filter((d): d is string => Boolean(d)) ?? [];
      const exceptionDates =
        recurrence.exceptions?.map((e) =>
          this.getScheduleLocalDayKey(e.occurrenceKey, event),
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
        ].map((v) => (typeof v === 'string' ? this.parseDateKey(v) : v)),
      );
      const iterationEnd = this.getMaxDate(
        [
          this.parseDateKey(rangeEndLocalDate),
          ...overrideOriginalDates,
          ...overridePatchedDates,
          ...exceptionDates,
        ].map((v) => (typeof v === 'string' ? this.parseDateKey(v) : v)),
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
            const occStart = new Date(current);
            occStart.setHours(
              baseStart.getHours(),
              baseStart.getMinutes(),
              baseStart.getSeconds(),
              baseStart.getMilliseconds(),
            );
            return occStart.toISOString();
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
          ...(override as Partial<ExpandedClassSchedule>),
          ids: { ...event.ids, id: `${event.ids.id}__${occurrenceKey}` },
          startAt:
            (override as { startAt?: string } | undefined)?.startAt ??
            occurrenceStart.toISOString(),
          endAt:
            (override as { endAt?: string } | undefined)?.endAt ??
            occurrenceEnd.toISOString(),
          status:
            ((override as { status?: string } | undefined)?.status as
              | EventStatusVM
              | undefined) ?? (hasOverride ? 'rescheduled' : event.status),
          recurrence: event.recurrence,
          uiState: hasOverride
            ? {
                kind: 'override',
                reason:
                  typeof (override as { description?: unknown })?.description === 'string'
                    ? ((override as { description: string }).description ?? null)
                    : typeof (override as { reason?: unknown })?.reason === 'string'
                      ? ((override as { reason: string }).reason ?? null)
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
}
