import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import {
  addDays,
  parseDateKey,
  toDateKey,
} from '@iconicedu/api/modules/reminders/schedule-expansion.util';
import type {
  CancelSessionDto,
  DeleteSchedulesDto,
  RecurrenceExceptionInput,
  RecurrenceOverrideInput,
  ReplaceSchedulesDto,
  RescheduleSessionDto,
  ScheduleRowInput,
  SplitRecurringSessionDto,
} from '@iconicedu/api/modules/schedules/dto';

const CLASS_SCHEDULE_SELECT = `
  id, org_id, title, description, location, meeting_link,
  start_at, end_at, timezone, status, visibility, theme_key,
  source_kind, source_learning_space_id, source_channel_id,
  source_session_id, source_owner_user_id, source_created_by_user_id,
  source_related_learning_space_id,
  created_at, created_by, updated_at, updated_by,
  participants:class_schedule_participants(
    id, org_id, profile_id, role, status, display_name, avatar_url, theme_key
  ),
  recurrence:class_schedule_recurrence(
    id, org_id, frequency, interval, count, until, timezone, byday,
    exceptions:class_schedule_recurrence_exceptions(id, occurrence_key, reason),
    overrides:class_schedule_recurrence_overrides(id, occurrence_key, patch)
  )
`;

type InsertedScheduleActivityInput = {
  scheduleId: string;
  schedule: ScheduleRowInput;
};

type RescheduleActivityContext = {
  scheduleId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  learningSpaceId: string | null;
  channelId: string | null;
  members: Array<{
    profileId: string;
    role: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    themeKey: string | null;
  }>;
};

type ScheduleOverrideLookupRow = {
  id: string;
  patch: Record<string, unknown> | null;
  updated_at: string | null;
  created_at: string | null;
};

type RecurrenceExceptionRow = {
  occurrence_key: string;
  reason: string | null;
  suppress_notifications: boolean | null;
};
type RecurrenceOverrideRow = {
  occurrence_key: string;
  patch: Record<string, unknown> | null;
  suppress_notifications: boolean | null;
};

/** Detail shape needed for both the "whole series" reschedule and the
 * "this and following" split — enough to validate the recurrence is a simple
 * weekly/single-weekday rule and to partition its exceptions/overrides. */
type RecurrenceSplitLookupRow = {
  id: string;
  frequency: string;
  timezone: string | null;
  until: string | null;
  count: number | null;
  byday: string[] | null;
  exceptions: RecurrenceExceptionRow[] | null;
  overrides: RecurrenceOverrideRow[] | null;
};

@Injectable()
export class SchedulesService {
  constructor(private readonly reminderReconcileService?: ReminderReconcileService) {}

  // ─── Read endpoints ──────────────────────────────────────────────────────────

  async list(accessToken: string, input: { orgId: string; channelId?: string }) {
    const supabase = createSupabaseSessionClient(accessToken);
    let query = supabase
      .from('class_schedules')
      .select(CLASS_SCHEDULE_SELECT)
      .eq('org_id', input.orgId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .order('start_at', { ascending: true });
    if (input.channelId) query = query.eq('source_channel_id', input.channelId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return this.attachLearningSpaceArchiveMetadata(input.orgId, data ?? []);
  }

  async createException(
    accessToken: string,
    body: { orgId: string; scheduleId: string; date: string; reason?: string | null },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('class_schedule_recurrence_exceptions')
      .insert({
        org_id: body.orgId,
        recurrence_id: body.scheduleId,
        occurrence_key: body.date,
        reason: body.reason?.trim() || null,
      })
      .select('occurrence_key, reason')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ─── Write endpoints ─────────────────────────────────────────────────────────

  async replaceSchedulesForLearningSpace(
    accessToken: string,
    dto: ReplaceSchedulesDto,
  ): Promise<{ scheduleIds: string[] }> {
    const actor = await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const actorProfileId = actor.profileId ?? dto.createdBy;

    const existing = await this.loadExistingSchedulesForSync(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
    );
    const existingIds = new Set(existing.scheduleIds);

    // Partition the incoming list: a schedule carrying an `id` that matches a
    // currently-existing row is updated in place; everything else is a fresh
    // insert. A client-supplied id is never trusted on its own — it only ever
    // takes effect if it matches a row we just loaded for this exact org +
    // learning space, so a stale/foreign/cross-tenant id degrades safely into
    // "treat as insert" rather than updating the wrong row.
    const seenExistingIds = new Set<string>();
    const toUpdate: Array<{ existingScheduleId: string; schedule: ScheduleRowInput }> =
      [];
    const toInsert: ScheduleRowInput[] = [];
    for (const schedule of dto.schedules) {
      if (
        schedule.id &&
        existingIds.has(schedule.id) &&
        !seenExistingIds.has(schedule.id)
      ) {
        seenExistingIds.add(schedule.id);
        toUpdate.push({ existingScheduleId: schedule.id, schedule });
      } else {
        toInsert.push(schedule);
      }
    }

    // Anything existing that wasn't matched by an incoming `id` is being removed.
    // `dto.removedScheduleIds` is unioned in as defense-in-depth (it's normally
    // already implied by "not referenced above") — an id `toUpdate` claimed always
    // wins over a stale removal instruction for the same id.
    const toRemoveIds = existing.scheduleIds
      .filter((id) => !seenExistingIds.has(id))
      .concat(dto.removedScheduleIds.filter((id) => existingIds.has(id)));
    const uniqueToRemoveIds = [...new Set(toRemoveIds)].filter(
      (id) => !seenExistingIds.has(id),
    );

    // Remove first: cancel-before-hard-delete ordering for the FK on reminder_jobs
    // (see cascadeDeleteSchedules) needs the removed set settled before we touch
    // anything else, and keeps this step self-contained/easy to reason about.
    if (uniqueToRemoveIds.length) {
      await this.cascadeDeleteSchedules(
        supabase,
        dto.orgId,
        uniqueToRemoveIds,
        actorProfileId,
      );
    }

    const scheduleIds: string[] = [];
    const insertedForActivity: InsertedScheduleActivityInput[] = [];
    const updatedForActivity: Array<{
      scheduleId: string;
      schedule: ScheduleRowInput;
      previousUntil: string | null;
    }> = [];

    for (const { existingScheduleId, schedule } of toUpdate) {
      scheduleIds.push(existingScheduleId);
      const previousUntil =
        existing.recurrenceUntilByScheduleId.get(existingScheduleId) ?? null;
      await this.updateScheduleInPlace(
        supabase,
        dto,
        existingScheduleId,
        existing.recurrenceIdByScheduleId.get(existingScheduleId) ?? null,
        schedule,
        actorProfileId,
        now,
      );
      updatedForActivity.push({
        scheduleId: existingScheduleId,
        schedule,
        previousUntil,
      });
    }

    for (const schedule of toInsert) {
      const scheduleId = randomUUID();
      scheduleIds.push(scheduleId);

      const { error: scheduleError } = await supabase.from('class_schedules').insert({
        id: scheduleId,
        org_id: dto.orgId,
        title: dto.title,
        description: dto.description,
        location: null,
        meeting_link: null,
        start_at: schedule.startAt,
        end_at: schedule.endAt,
        timezone: schedule.timezone,
        status: 'scheduled',
        visibility: 'class-members',
        theme_key: dto.themeKey ?? null,
        source_kind: 'class_session',
        source_learning_space_id: dto.learningSpaceId,
        source_channel_id: dto.channelId,
        created_at: now,
        created_by: dto.createdBy,
        updated_at: now,
        updated_by: dto.createdBy,
      });

      if (scheduleError) {
        throw new InternalServerErrorException(scheduleError.message);
      }

      await this.insertScheduleParticipants(
        supabase,
        dto.orgId,
        scheduleId,
        dto.participants,
        dto.createdBy,
        now,
      );

      if (schedule.recurrence) {
        await this.insertScheduleRecurrence(
          supabase,
          dto.orgId,
          scheduleId,
          schedule,
          dto.createdBy,
          now,
        );
      }

      insertedForActivity.push({ scheduleId, schedule });
    }

    await this.publishScheduleSyncActivities({
      supabase,
      dto,
      inserted: insertedForActivity,
      updated: updatedForActivity,
    });

    // Reconcile reminders once, after all writes commit — reads the current
    // schedule set from the DB, cancels orphaned jobs for removed schedules, and
    // idempotently (re)builds jobs for every remaining one, including untouched
    // schedules (a cheap no-op for those). Closes the gap where this bulk-edit
    // flow previously never generated reminder/completion-check jobs synchronously
    // at all, relying solely on an async DB-trigger reconciliation pass.
    await this.reminderReconcileService?.reconcileAllSchedulesForLearningSpace(
      dto.orgId,
      dto.learningSpaceId,
    );

    return { scheduleIds };
  }

  async deleteSchedulesForLearningSpace(
    accessToken: string,
    dto: DeleteSchedulesDto,
  ): Promise<{ success: true }> {
    const actor = await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();

    await this.cascadeDeleteSchedulesForLearningSpace(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
      actor.profileId ?? null,
    );

    return { success: true };
  }

  async cancelScheduleSession(
    accessToken: string,
    dto: CancelSessionDto,
  ): Promise<{ success: true; mode: 'single' | 'recurring' }> {
    const actor = await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();

    // Check if it has recurrence
    const { data: recurrenceRow, error: recurrenceError } = await supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', dto.orgId)
      .eq('schedule_id', dto.scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (recurrenceError) {
      throw new InternalServerErrorException(recurrenceError.message);
    }

    if (!recurrenceRow) {
      // Non-recurring: update status
      const { error: updateError } = await supabase
        .from('class_schedules')
        .update({
          status: 'cancelled',
          updated_at: now,
          updated_by: actor.profileId,
        })
        .eq('id', dto.scheduleId)
        .eq('org_id', dto.orgId)
        .is('deleted_at', null);

      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }

      return { success: true, mode: 'single' };
    }

    const occurrenceKey = dto.occurrenceKey;
    if (!occurrenceKey) {
      throw new BadRequestException('occurrenceKey is required for recurring sessions');
    }

    // Delete any existing override for this occurrence
    await supabase
      .from('class_schedule_recurrence_overrides')
      .delete()
      .eq('org_id', dto.orgId)
      .eq('recurrence_id', recurrenceRow.id)
      .eq('occurrence_key', occurrenceKey);

    // Upsert exception
    const { data: existingException } = await supabase
      .from('class_schedule_recurrence_exceptions')
      .select('id')
      .eq('org_id', dto.orgId)
      .eq('recurrence_id', recurrenceRow.id)
      .eq('occurrence_key', occurrenceKey)
      .maybeSingle<{ id: string }>();

    if (existingException) {
      const { error: updateError } = await supabase
        .from('class_schedule_recurrence_exceptions')
        .update({
          reason: dto.reason,
          suppress_notifications: dto.suppressNotifications,
          updated_at: now,
          updated_by: actor.profileId,
        })
        .eq('id', existingException.id)
        .eq('org_id', dto.orgId);

      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from('class_schedule_recurrence_exceptions')
        .insert({
          id: randomUUID(),
          org_id: dto.orgId,
          recurrence_id: recurrenceRow.id,
          occurrence_key: occurrenceKey,
          reason: dto.reason,
          suppress_notifications: dto.suppressNotifications,
          created_at: now,
          created_by: actor.profileId,
          updated_at: now,
          updated_by: actor.profileId,
        });

      if (insertError) {
        throw new InternalServerErrorException(insertError.message);
      }
    }

    return { success: true, mode: 'recurring' };
  }

  async rescheduleScheduleSession(
    accessToken: string,
    dto: RescheduleSessionDto,
  ): Promise<
    | { success: true; mode: 'single' | 'recurring' }
    | {
        requiresConfirmation: true;
        futureOverrideCount: number;
        futureExceptionCount: number;
      }
  > {
    const actor = await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const activityContext = await this.loadRescheduleActivityContext(
      supabase,
      dto.orgId,
      dto.scheduleId,
    );

    const { data: recurrenceRow, error: recurrenceError } = await supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', dto.orgId)
      .eq('schedule_id', dto.scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (recurrenceError) {
      throw new InternalServerErrorException(recurrenceError.message);
    }

    if (!recurrenceRow) {
      const oldStartAt = activityContext?.startAt ?? null;
      const oldEndAt = activityContext?.endAt ?? null;

      const { error: updateError } = await supabase
        .from('class_schedules')
        .update({
          start_at: dto.startAt,
          end_at: dto.endAt,
          timezone: dto.timezone,
          updated_at: now,
          updated_by: actor.profileId,
        })
        .eq('id', dto.scheduleId)
        .eq('org_id', dto.orgId)
        .is('deleted_at', null);

      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }

      await this.publishSessionRescheduledActivity({
        supabase,
        orgId: dto.orgId,
        actorProfileId: actor.profileId,
        context: activityContext,
        oldStartAt,
        oldEndAt,
        newStartAt: dto.startAt,
        newEndAt: dto.endAt,
        reason: dto.reason,
        suppressNotifications: dto.suppressNotifications,
        dedupeKey: `class.session.rescheduled:${dto.orgId}:${dto.scheduleId}:${oldStartAt ?? dto.startAt}`,
      });
      await this.reconcileRemindersForSchedule(dto.orgId, dto.scheduleId);

      return { success: true, mode: 'single' };
    }

    if (dto.scope === 'all') {
      return this.rescheduleEntireRecurringSeries(
        supabase,
        dto,
        recurrenceRow.id,
        actor.profileId,
        now,
        activityContext,
      );
    }

    const occurrenceKey = dto.occurrenceKey;
    if (!occurrenceKey) {
      throw new BadRequestException('occurrenceKey is required for recurring sessions');
    }

    await supabase
      .from('class_schedule_recurrence_exceptions')
      .delete()
      .eq('org_id', dto.orgId)
      .eq('recurrence_id', recurrenceRow.id)
      .eq('occurrence_key', occurrenceKey);

    const patch = {
      startAt: dto.startAt,
      endAt: dto.endAt,
      ...(dto.reason ? { reason: dto.reason } : {}),
    };

    const existingOverrides = await this.loadActiveOverridesForOccurrence({
      supabase,
      orgId: dto.orgId,
      recurrenceId: recurrenceRow.id,
      occurrenceKey,
    });
    const existingOverride = existingOverrides[0] ?? null;
    const duplicateOverrideIds = existingOverrides
      .slice(1)
      .map((override) => override.id);

    const overrideId = existingOverride?.id ?? randomUUID();

    if (existingOverride) {
      const { error: updateError } = await supabase
        .from('class_schedule_recurrence_overrides')
        .update({
          patch,
          suppress_notifications: dto.suppressNotifications,
          updated_at: now,
          updated_by: actor.profileId,
        })
        .eq('id', existingOverride.id)
        .eq('org_id', dto.orgId);

      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from('class_schedule_recurrence_overrides')
        .insert({
          id: overrideId,
          org_id: dto.orgId,
          recurrence_id: recurrenceRow.id,
          occurrence_key: occurrenceKey,
          patch,
          suppress_notifications: dto.suppressNotifications,
          created_at: now,
          created_by: actor.profileId,
          updated_at: now,
          updated_by: actor.profileId,
        });

      if (insertError) {
        throw new InternalServerErrorException(insertError.message);
      }
    }

    if (duplicateOverrideIds.length) {
      await this.deleteDuplicateOverrides({
        supabase,
        orgId: dto.orgId,
        duplicateOverrideIds,
      });
    }

    const oldStartAt =
      typeof existingOverride?.patch?.startAt === 'string'
        ? existingOverride.patch.startAt
        : occurrenceKey;
    const oldEndAt =
      typeof existingOverride?.patch?.endAt === 'string'
        ? existingOverride.patch.endAt
        : this.shiftOccurrenceEnd(occurrenceKey, activityContext);

    await this.publishSessionRescheduledActivity({
      supabase,
      orgId: dto.orgId,
      actorProfileId: actor.profileId,
      context: activityContext,
      oldStartAt,
      oldEndAt,
      newStartAt: dto.startAt,
      newEndAt: dto.endAt,
      reason: dto.reason,
      suppressNotifications: dto.suppressNotifications,
      dedupeKey: `class.session.rescheduled:${dto.orgId}:${overrideId}`,
    });
    await this.reconcileRemindersForSchedule(dto.orgId, dto.scheduleId);

    return { success: true, mode: 'recurring' };
  }

  /**
   * "This and following events": truncates the existing recurring series as of
   * the edited occurrence's local calendar day and creates a brand-new series
   * carrying the new day/time/weekday forward. The old `class_schedules.id` is
   * never touched — `class_session_completions` rows already attached to it
   * stay correctly attributed to history. v1 only supports splitting into a
   * single new weekday (the existing rule must already be weekly/single-weekday
   * too); anything more complex should go through the full classroom editor.
   */
  async splitRecurringSeries(
    accessToken: string,
    dto: SplitRecurringSessionDto,
  ): Promise<
    | { success: true; oldScheduleId: string; newScheduleId: string }
    | {
        requiresConfirmation: true;
        futureOverrideCount: number;
        futureExceptionCount: number;
      }
  > {
    const actor = await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();

    if (!dto.byWeekday || dto.byWeekday.length !== 1) {
      throw new BadRequestException('byWeekday must contain exactly one weekday');
    }

    const activityContext = await this.loadRescheduleActivityContext(
      supabase,
      dto.orgId,
      dto.scheduleId,
    );
    if (!activityContext) {
      throw new BadRequestException('Schedule not found');
    }

    const recurrenceDetail = await this.loadRecurrenceSplitDetail(
      supabase,
      dto.orgId,
      dto.scheduleId,
    );
    if (!recurrenceDetail) {
      throw new BadRequestException('This schedule is not recurring');
    }
    this.assertSimpleWeeklyRecurrence(recurrenceDetail);
    if (recurrenceDetail.count != null) {
      // The split copies the old recurrence's `count` verbatim onto the new
      // series (it has no way to know how many occurrences the old series
      // already consumed before the split point), which would let a
      // count-limited series run for longer than originally intended. Until
      // that's computed correctly, route count-limited recurrences to the
      // full classroom editor instead of silently over-running.
      throw new BadRequestException(
        'This quick edit does not support recurrences limited by an occurrence count — use the full classroom editor for this schedule.',
      );
    }

    const scheduleTimezone =
      activityContext.timezone ?? recurrenceDetail.timezone ?? 'UTC';

    const exceptions = recurrenceDetail.exceptions ?? [];
    if (exceptions.some((e) => e.occurrence_key === dto.occurrenceKey)) {
      throw new BadRequestException('Cannot split a series on a cancelled occurrence');
    }

    // Always the OLD schedule's timezone — occurrenceKey was generated against
    // it, and reinterpreting it in a new target timezone (if one is being set as
    // part of this same edit) could shift the split boundary by a day.
    const splitLocalDate =
      getLocalDate(dto.occurrenceKey, scheduleTimezone) ?? dto.occurrenceKey.slice(0, 10);
    const nowLocalDate = getLocalDate(now, scheduleTimezone) ?? now.slice(0, 10);
    if (splitLocalDate < nowLocalDate) {
      // The UI is expected to prevent splitting on a past occurrence entirely;
      // this is a warn-only backstop since server/client clock and timezone
      // resolution can legitimately disagree by a day at the boundary.
      // eslint-disable-next-line no-console
      console.warn(
        `splitRecurringSeries: split date ${splitLocalDate} is in the past for schedule ${dto.scheduleId}`,
      );
    }

    if (recurrenceDetail.until) {
      const untilLocalDate =
        getLocalDate(recurrenceDetail.until, scheduleTimezone) ??
        recurrenceDetail.until.slice(0, 10);
      if (splitLocalDate > untilLocalDate) {
        throw new BadRequestException(
          'This occurrence is past the series end date and can no longer be split — the series may have just been ended by another edit.',
        );
      }
    }

    const cutoffLocalDate = toDateKey(addDays(parseDateKey(splitLocalDate), -1));
    const oldUntil =
      toUtcFromLocal(cutoffLocalDate, '23:59', scheduleTimezone) ??
      new Date(`${cutoffLocalDate}T23:59:00Z`).toISOString();

    const isBeforeSplit = (occurrenceKey: string) => {
      const localDate =
        getLocalDate(occurrenceKey, scheduleTimezone) ?? occurrenceKey.slice(0, 10);
      return localDate < splitLocalDate;
    };
    const overrides = recurrenceDetail.overrides ?? [];
    const keptExceptions = exceptions.filter((e) => isBeforeSplit(e.occurrence_key));
    const keptOverrides = overrides.filter((o) => isBeforeSplit(o.occurrence_key));
    const droppedExceptionCount = exceptions.length - keptExceptions.length;
    const droppedOverrideCount = overrides.length - keptOverrides.length;

    // Splitting always drops the exceptions/overrides on/after the split
    // point (they belonged to occurrences the old pattern produced, which
    // stop existing once the series forks) — that's destructive in the same
    // way a weekday change under 'all' scope is, so it gets the same
    // confirm-before-dropping treatment.
    if (
      (droppedExceptionCount > 0 || droppedOverrideCount > 0) &&
      !dto.confirmDropFutureOverrides
    ) {
      return {
        requiresConfirmation: true,
        futureOverrideCount: droppedOverrideCount,
        futureExceptionCount: droppedExceptionCount,
      };
    }

    const { data: newScheduleId, error: rpcError } = await supabase.rpc(
      'split_class_schedule_recurrence',
      {
        p_org_id: dto.orgId,
        p_schedule_id: dto.scheduleId,
        p_old_until: oldUntil,
        p_kept_exceptions: keptExceptions.map((e) => ({
          occurrenceKey: e.occurrence_key,
          reason: e.reason,
          suppressNotifications: e.suppress_notifications ?? false,
        })),
        p_kept_overrides: keptOverrides.map((o) => ({
          occurrenceKey: o.occurrence_key,
          patch: o.patch,
          suppressNotifications: o.suppress_notifications ?? false,
        })),
        p_new_start_at: dto.newStartAt,
        p_new_end_at: dto.newEndAt,
        p_new_timezone: dto.timezone ?? scheduleTimezone,
        p_new_byday: dto.byWeekday,
        p_actor_profile_id: actor.profileId,
        p_now: now,
      },
    );

    if (rpcError) {
      throw new InternalServerErrorException(rpcError.message);
    }

    const resolvedNewScheduleId = newScheduleId as string;

    // The split already committed above — a failure past this point must not
    // turn an already-applied split into an error response (a naive retry
    // would then hit the "past the series end date" rejection since the old
    // series is already truncated). The DB-trigger-driven async reconcile
    // queue is the fallback if the reconcile calls below are skipped.
    try {
      await this.publishScheduleSplitActivities({
        supabase,
        orgId: dto.orgId,
        actorProfileId: actor.profileId,
        context: activityContext,
        oldUntil,
        newScheduleId: resolvedNewScheduleId,
        newStartAt: dto.newStartAt,
        newEndAt: dto.newEndAt,
        reason: dto.reason,
        suppressNotifications: dto.suppressNotifications,
      });

      // Reconcile is per-scheduleId (see reconcileRemindersForSchedule's own
      // doc), so both the truncated old series and the new one need their own
      // call — reconciling one does nothing for the other.
      await this.reconcileRemindersForSchedule(dto.orgId, dto.scheduleId);
      await this.reconcileRemindersForSchedule(dto.orgId, resolvedNewScheduleId);
    } catch (postCommitError) {
      // eslint-disable-next-line no-console
      console.error(
        `splitRecurringSeries: post-commit activity/reconcile failed for ${dto.scheduleId} -> ${resolvedNewScheduleId}`,
        postCommitError,
      );
    }

    return {
      success: true,
      oldScheduleId: dto.scheduleId,
      newScheduleId: resolvedNewScheduleId,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async requireOrgActor(accessToken: string, orgId: string) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();

    if (userError || !user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const { data: account, error: accountError } = await createSupabaseServiceClient()
      .from('accounts')
      .select('id, active_profile_id')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; active_profile_id: string | null }>();

    if (accountError) {
      throw new InternalServerErrorException(accountError.message);
    }
    if (!account) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const { data: roles, error: rolesError } = await createSupabaseServiceClient()
      .from('user_roles')
      .select('role_key')
      .eq('account_id', account.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<Array<{ role_key: string | null }>>();

    if (rolesError) {
      throw new InternalServerErrorException(rolesError.message);
    }

    const canManageSchedules = (roles ?? []).some(
      (role) =>
        role.role_key === 'owner' ||
        role.role_key === 'admin' ||
        role.role_key === 'staff',
    );
    if (!canManageSchedules) {
      throw new ForbiddenException('Forbidden');
    }

    const profileId =
      account.active_profile_id ??
      (await this.resolveFallbackActorProfileId(orgId, account.id)) ??
      account.id;

    return {
      accountId: account.id,
      profileId,
    };
  }

  private async resolveFallbackActorProfileId(orgId: string, accountId: string) {
    const { data, error } = await createSupabaseServiceClient()
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data?.id ?? null;
  }

  private async loadActiveOverridesForOccurrence(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    recurrenceId: string;
    occurrenceKey: string;
  }) {
    const { data, error } = await input.supabase
      .from('class_schedule_recurrence_overrides')
      .select('id, patch, updated_at, created_at')
      .eq('org_id', input.orgId)
      .eq('recurrence_id', input.recurrenceId)
      .eq('occurrence_key', input.occurrenceKey)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ScheduleOverrideLookupRow[]>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
  }

  private async deleteDuplicateOverrides(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    duplicateOverrideIds: string[];
  }) {
    const { error } = await input.supabase
      .from('class_schedule_recurrence_overrides')
      .delete()
      .eq('org_id', input.orgId)
      .in('id', input.duplicateOverrideIds);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async loadRescheduleActivityContext(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleId: string,
  ): Promise<RescheduleActivityContext | null> {
    const { data, error } = await supabase
      .from('class_schedules')
      .select(
        `
          id, title, start_at, end_at, timezone,
          source_learning_space_id, source_channel_id,
          participants:class_schedule_participants(
            profile_id, role, display_name, avatar_url, theme_key
          )
        `,
      )
      .eq('org_id', orgId)
      .eq('id', scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        title: string;
        start_at: string;
        end_at: string;
        timezone: string | null;
        source_learning_space_id: string | null;
        source_channel_id: string | null;
        participants: Array<{
          profile_id: string;
          role: string | null;
          display_name: string | null;
          avatar_url: string | null;
          theme_key: string | null;
        }> | null;
      }>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      return null;
    }

    return {
      scheduleId: data.id,
      title: data.title,
      startAt: data.start_at,
      endAt: data.end_at,
      timezone: data.timezone,
      learningSpaceId: data.source_learning_space_id,
      channelId: data.source_channel_id,
      members: (data.participants ?? []).map((participant) => ({
        profileId: participant.profile_id,
        role: participant.role,
        displayName: participant.display_name,
        avatarUrl: participant.avatar_url,
        themeKey: participant.theme_key,
      })),
    };
  }

  private async publishSessionRescheduledActivity(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    actorProfileId: string | null;
    context: RescheduleActivityContext | null;
    oldStartAt: string | null;
    oldEndAt: string | null;
    newStartAt: string;
    newEndAt: string;
    reason: string | null;
    suppressNotifications: boolean;
    dedupeKey: string;
  }) {
    if (!input.context?.learningSpaceId || !input.context.channelId) {
      return;
    }

    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'class.session.rescheduled',
      sourceKind: input.actorProfileId ? 'profile' : 'system',
      actorProfileId: input.actorProfileId,
      scope: {
        kind: 'learning_space',
        learningSpaceId: input.context.learningSpaceId,
      },
      objectRef: {
        kind: 'session',
        id: input.oldStartAt ?? input.newStartAt,
      },
      targetRef: { kind: 'learning_space', id: input.context.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        learningSpaceId: input.context.learningSpaceId,
        channelId: input.context.channelId,
        scheduleId: input.context.scheduleId,
        title: input.context.title,
        learningSpaceTitle: input.context.title,
        channelRouteKind: 'space',
        startAt: input.newStartAt,
        endAt: input.newEndAt,
        occurrenceStart: input.oldStartAt,
        rescheduledFromStartAt: input.oldStartAt,
        rescheduledFromEndAt: input.oldEndAt,
        rescheduledToStartAt: input.newStartAt,
        rescheduledToEndAt: input.newEndAt,
        rescheduledReason: input.reason,
        reason: input.reason,
        timezone: input.context.timezone,
        firstSessionStartAt: input.newStartAt,
        firstSessionTimezone: input.context.timezone,
        members: input.context.members,
        suppressNotifications: input.suppressNotifications,
      },
      dedupeKey: input.dedupeKey,
      refreshOnDedupe: true,
      createdBy: input.actorProfileId,
    });
  }

  private async loadRecurrenceSplitDetail(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleId: string,
  ): Promise<RecurrenceSplitLookupRow | null> {
    const { data, error } = await supabase
      .from('class_schedule_recurrence')
      .select(
        `
          id, frequency, timezone, until, count, byday,
          exceptions:class_schedule_recurrence_exceptions(occurrence_key, reason, suppress_notifications),
          overrides:class_schedule_recurrence_overrides(occurrence_key, patch, suppress_notifications)
        `,
      )
      .eq('org_id', orgId)
      .eq('schedule_id', scheduleId)
      .is('deleted_at', null)
      .maybeSingle<RecurrenceSplitLookupRow>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ?? null;
  }

  /** v1 of the quick-edit "This and following"/"All events" scopes only
   * supports the simple weekly + single-weekday shape that `expandRecurringEvents`
   * actually implements (monthly/yearly/multi-weekday DB columns exist but
   * aren't consumed by expansion) — anything else must go through the full
   * classroom editor, which accepts arbitrary RecurrenceRowInput shapes. */
  private assertSimpleWeeklyRecurrence(recurrence: RecurrenceSplitLookupRow) {
    if (recurrence.frequency !== 'weekly' || (recurrence.byday ?? []).length !== 1) {
      throw new BadRequestException(
        'This quick edit only supports a simple weekly, single-weekday recurrence — use the full classroom editor for this schedule.',
      );
    }
  }

  /**
   * "All events": rewrites the recurrence rule in place on the existing
   * schedule/recurrence row (no new schedule id). If the weekday is changing,
   * any future exceptions/overrides no longer match the new pattern's day and
   * must be dropped — since that's destructive, the caller has to explicitly
   * confirm via `dto.confirmDropFutureOverrides` once told how many would be
   * affected.
   */
  private async rescheduleEntireRecurringSeries(
    supabase: SupabaseServiceClient,
    dto: RescheduleSessionDto,
    recurrenceId: string,
    actorProfileId: string,
    now: string,
    activityContext: RescheduleActivityContext | null,
  ): Promise<
    | { success: true; mode: 'recurring' }
    | {
        requiresConfirmation: true;
        futureOverrideCount: number;
        futureExceptionCount: number;
      }
  > {
    const recurrenceDetail = await this.loadRecurrenceSplitDetail(
      supabase,
      dto.orgId,
      dto.scheduleId,
    );
    if (!recurrenceDetail) {
      throw new BadRequestException('This schedule is not recurring');
    }
    this.assertSimpleWeeklyRecurrence(recurrenceDetail);
    // Defensive: `parseRescheduleSessionDto` already enforces this shape for
    // HTTP callers, but this method is also called directly (e.g. from
    // tests, or any future in-process caller), so don't rely solely on the
    // controller-layer parser having run.
    if (!dto.byWeekday || dto.byWeekday.length !== 1) {
      throw new BadRequestException("scope 'all' requires exactly one byWeekday entry");
    }

    const newByWeekday = dto.byWeekday[0]!;
    const weekdayChanged = (recurrenceDetail.byday ?? [])[0] !== newByWeekday;
    // Always the OLD schedule's timezone for interpreting EXISTING timestamps
    // (occurrence keys, start_at) — same rule as splitRecurringSeries. If this
    // edit also changes timezone, reinterpreting old timestamps in the new
    // zone could shift date-boundary comparisons by a day near midnight.
    const oldTimezone = recurrenceDetail.timezone ?? activityContext?.timezone ?? 'UTC';
    // The timezone the series operates under going forward — used only for
    // the NEW start/end time-of-day and for what gets written to the DB.
    const newTimezone = dto.timezone ?? oldTimezone;
    const todayLocalDate = getLocalDate(now, oldTimezone) ?? now.slice(0, 10);

    const isFuture = (occurrenceKey: string) => {
      const localDate =
        getLocalDate(occurrenceKey, oldTimezone) ?? occurrenceKey.slice(0, 10);
      return localDate >= todayLocalDate;
    };

    const exceptions = recurrenceDetail.exceptions ?? [];
    const overrides = recurrenceDetail.overrides ?? [];
    const futureExceptions = exceptions.filter((e) => isFuture(e.occurrence_key));
    const futureOverrides = overrides.filter((o) => isFuture(o.occurrence_key));

    if (
      weekdayChanged &&
      (futureExceptions.length > 0 || futureOverrides.length > 0) &&
      !dto.confirmDropFutureOverrides
    ) {
      return {
        requiresConfirmation: true,
        futureOverrideCount: futureOverrides.length,
        futureExceptionCount: futureExceptions.length,
      };
    }

    const keptExceptions = weekdayChanged
      ? exceptions.filter((e) => !isFuture(e.occurrence_key))
      : exceptions;
    const keptOverrides = weekdayChanged
      ? overrides.filter((o) => !isFuture(o.occurrence_key))
      : overrides;

    // Preserve the schedule's own calendar DATE — only its time-of-day
    // changes here. `expandRecurringEvents` treats `start_at`'s local date as
    // a hard floor (no occurrence before it is ever generated), so writing
    // dto.startAt's date verbatim would silently erase every occurrence
    // (including already-happened ones the kept exceptions/overrides above
    // still need to render correctly) between the old date and the new one.
    // The weekday itself comes entirely from `byday`, not from this date.
    const preservedLocalDate =
      getLocalDate(activityContext?.startAt ?? now, oldTimezone) ?? now.slice(0, 10);
    const newStartLocalTime = getLocalTime(dto.startAt, newTimezone) ?? '00:00';
    const newEndLocalTime = getLocalTime(dto.endAt, newTimezone) ?? '00:00';
    const newStartAt =
      toUtcFromLocal(preservedLocalDate, newStartLocalTime, newTimezone) ?? dto.startAt;
    const newEndAt =
      toUtcFromLocal(preservedLocalDate, newEndLocalTime, newTimezone) ?? dto.endAt;

    // Wrapped in a transaction: this touches four tables (schedule,
    // recurrence, exceptions, overrides) — an unwrapped sequence here would
    // risk both a lost-update race (another edit's exception/override landing
    // between this read and the wholesale replace) and a partial-failure
    // window where the schedule's time and the recurrence's weekday disagree.
    const { error: rpcError } = await supabase.rpc(
      'update_class_schedule_recurrence_rule',
      {
        p_org_id: dto.orgId,
        p_schedule_id: dto.scheduleId,
        p_recurrence_id: recurrenceId,
        p_new_start_at: newStartAt,
        p_new_end_at: newEndAt,
        p_new_timezone: newTimezone,
        p_new_byday: dto.byWeekday,
        p_kept_exceptions: keptExceptions.map((e) => ({
          occurrenceKey: e.occurrence_key,
          reason: e.reason,
          suppressNotifications: e.suppress_notifications ?? false,
        })),
        p_kept_overrides: keptOverrides.map((o) => ({
          occurrenceKey: o.occurrence_key,
          patch: o.patch,
          suppressNotifications: o.suppress_notifications ?? false,
        })),
        p_actor_profile_id: actorProfileId,
        p_now: now,
      },
    );
    if (rpcError) {
      throw new InternalServerErrorException(rpcError.message);
    }

    // The rule change already committed above — a failure past this point
    // (activity publish, reminder reconcile) must not turn an already-applied
    // edit into an error response. The DB-trigger-driven async reconcile
    // queue is the belt-and-suspenders fallback if either of these is skipped.
    try {
      await this.publishSessionRescheduledActivity({
        supabase,
        orgId: dto.orgId,
        actorProfileId,
        context: activityContext,
        oldStartAt: activityContext?.startAt ?? null,
        oldEndAt: activityContext?.endAt ?? null,
        newStartAt,
        newEndAt,
        reason: dto.reason,
        suppressNotifications: dto.suppressNotifications,
        dedupeKey: `class.session.rescheduled:${dto.orgId}:${dto.scheduleId}:all:${now}`,
      });
      await this.reconcileRemindersForSchedule(dto.orgId, dto.scheduleId);
    } catch (postCommitError) {
      // eslint-disable-next-line no-console
      console.error(
        `rescheduleEntireRecurringSeries: post-commit activity/reconcile failed for schedule ${dto.scheduleId}`,
        postCommitError,
      );
    }

    return { success: true, mode: 'recurring' };
  }

  private async publishScheduleSplitActivities(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    actorProfileId: string | null;
    context: RescheduleActivityContext;
    oldUntil: string;
    newScheduleId: string;
    newStartAt: string;
    newEndAt: string;
    reason: string | null;
    suppressNotifications: boolean;
  }) {
    if (!input.context.learningSpaceId || !input.context.channelId) {
      return;
    }

    const basePayload = {
      learningSpaceId: input.context.learningSpaceId,
      channelId: input.context.channelId,
      suppressNotifications: input.suppressNotifications,
      title: input.context.title,
      learningSpaceTitle: input.context.title,
      channelRouteKind: 'space',
      members: input.context.members,
      reason: input.reason,
    };

    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'class.schedule.ended',
      sourceKind: input.actorProfileId ? 'profile' : 'system',
      actorProfileId: input.actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId: input.context.learningSpaceId },
      objectRef: { kind: 'schedule', id: input.context.scheduleId },
      targetRef: { kind: 'learning_space', id: input.context.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        ...basePayload,
        scheduleId: input.context.scheduleId,
        until: input.oldUntil,
        recurrenceUntil: input.oldUntil,
      },
      dedupeKey: `class.schedule.ended:${input.orgId}:${input.context.scheduleId}:${input.oldUntil}`,
      createdBy: input.actorProfileId,
    });

    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'class.schedule.created',
      sourceKind: input.actorProfileId ? 'profile' : 'system',
      actorProfileId: input.actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId: input.context.learningSpaceId },
      objectRef: { kind: 'schedule', id: input.newScheduleId },
      targetRef: { kind: 'learning_space', id: input.context.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        ...basePayload,
        scheduleId: input.newScheduleId,
        startAt: input.newStartAt,
        endAt: input.newEndAt,
      },
      dedupeKey: `class.schedule.created:${input.orgId}:${input.newScheduleId}`,
      createdBy: input.actorProfileId,
    });
  }

  private async reconcileRemindersForSchedule(orgId: string, scheduleId: string) {
    await this.reminderReconcileService?.reconcileNextReminderJobForSchedule({
      orgId,
      scheduleId,
    });
  }

  private shiftOccurrenceEnd(
    occurrenceStartAt: string,
    context: RescheduleActivityContext | null,
  ) {
    if (!context) {
      return null;
    }
    const baseStart = new Date(context.startAt).getTime();
    const baseEnd = new Date(context.endAt).getTime();
    const occurrenceStart = new Date(occurrenceStartAt).getTime();
    if (
      Number.isNaN(baseStart) ||
      Number.isNaN(baseEnd) ||
      Number.isNaN(occurrenceStart)
    ) {
      return null;
    }

    return new Date(occurrenceStart + (baseEnd - baseStart)).toISOString();
  }

  /** Thin wrapper preserving "delete every schedule in this learning space"
   * semantics for callers that want it (e.g. archiving/deleting a classroom). */
  private async cascadeDeleteSchedulesForLearningSpace(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
    actorProfileId: string | null,
  ) {
    const { data: existingSchedules, error: fetchError } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (fetchError) {
      throw new InternalServerErrorException(fetchError.message);
    }

    await this.cascadeDeleteSchedules(
      supabase,
      orgId,
      (existingSchedules ?? []).map((r) => r.id),
      actorProfileId,
    );
  }

  private async cascadeDeleteSchedules(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleIds: string[],
    actorProfileId: string | null,
  ) {
    if (!scheduleIds.length) return;
    const now = new Date().toISOString();

    // Cancel active reminder jobs before source_schedule_id is nulled by the FK.
    const { error: cancelJobsError } = await supabase
      .from('reminder_jobs')
      .update({
        status: 'canceled',
        lease_owner: null,
        lease_until: null,
        updated_at: now,
      })
      .eq('org_id', orgId)
      .in('source_schedule_id', scheduleIds)
      .not('status', 'in', '("succeeded","canceled","dead_letter")')
      .is('deleted_at', null);

    if (cancelJobsError) {
      throw new InternalServerErrorException(cancelJobsError.message);
    }

    const { data: completionRows, error: completionsError } = await supabase
      .from('class_session_completions')
      .select('schedule_id')
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds)
      .is('deleted_at', null)
      .returns<Array<{ schedule_id: string }>>();

    if (completionsError) {
      throw new InternalServerErrorException(completionsError.message);
    }

    const referencedScheduleIds = new Set(
      (completionRows ?? []).map((row) => row.schedule_id),
    );
    const softDeleteScheduleIds = scheduleIds.filter((id) =>
      referencedScheduleIds.has(id),
    );
    const hardDeleteScheduleIds = scheduleIds.filter(
      (id) => !referencedScheduleIds.has(id),
    );

    const { data: recurrenceRows, error: recurrenceError } = await supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds)
      .returns<Array<{ id: string }>>();

    if (recurrenceError) {
      throw new InternalServerErrorException(recurrenceError.message);
    }

    const recurrenceIds = (recurrenceRows ?? []).map((r) => r.id);

    if (recurrenceIds.length) {
      const { error: e1 } = await supabase
        .from('class_schedule_recurrence_exceptions')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds);
      if (e1) throw new InternalServerErrorException(e1.message);

      const { error: e2 } = await supabase
        .from('class_schedule_recurrence_overrides')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds);
      if (e2) throw new InternalServerErrorException(e2.message);

      const { error: e3 } = await supabase
        .from('class_schedule_recurrence')
        .delete()
        .eq('org_id', orgId)
        .in('schedule_id', scheduleIds);
      if (e3) throw new InternalServerErrorException(e3.message);
    }

    const { error: e4 } = await supabase
      .from('class_schedule_participants')
      .delete()
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds);
    if (e4) throw new InternalServerErrorException(e4.message);

    if (hardDeleteScheduleIds.length) {
      const { error: e5 } = await supabase
        .from('class_schedules')
        .delete()
        .eq('org_id', orgId)
        .in('id', hardDeleteScheduleIds);
      if (e5) throw new InternalServerErrorException(e5.message);
    }

    if (softDeleteScheduleIds.length) {
      const { error: e6 } = await supabase
        .from('class_schedules')
        .update({
          status: 'cancelled',
          deleted_at: now,
          deleted_by: actorProfileId,
          updated_at: now,
          updated_by: actorProfileId,
        })
        .eq('org_id', orgId)
        .in('id', softDeleteScheduleIds);
      if (e6) throw new InternalServerErrorException(e6.message);
    }
  }

  /**
   * The ground truth the in-place sync needs to partition an incoming schedule
   * list into update/insert/remove: which schedule ids currently exist for this
   * learning space, and — for ones that carry an active recurrence — its row id
   * (to update in place) and current `until` (to detect a newly-added end date
   * for activity publishing, same as the old signature-matching heuristic did).
   */
  private async loadExistingSchedulesForSync(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
  ) {
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (scheduleError) {
      throw new InternalServerErrorException(scheduleError.message);
    }

    const scheduleIds = (scheduleRows ?? []).map((row) => row.id);
    const recurrenceIdByScheduleId = new Map<string, string>();
    const recurrenceUntilByScheduleId = new Map<string, string | null>();

    if (scheduleIds.length) {
      const { data: recurrenceRows, error: recurrenceError } = await supabase
        .from('class_schedule_recurrence')
        .select('id, schedule_id, until')
        .eq('org_id', orgId)
        .in('schedule_id', scheduleIds)
        .is('deleted_at', null)
        .returns<Array<{ id: string; schedule_id: string; until: string | null }>>();

      if (recurrenceError) {
        throw new InternalServerErrorException(recurrenceError.message);
      }

      for (const row of recurrenceRows ?? []) {
        recurrenceIdByScheduleId.set(row.schedule_id, row.id);
        recurrenceUntilByScheduleId.set(row.schedule_id, row.until ?? null);
      }
    }

    return { scheduleIds, recurrenceIdByScheduleId, recurrenceUntilByScheduleId };
  }

  private async publishScheduleSyncActivities(input: {
    supabase: SupabaseServiceClient;
    dto: ReplaceSchedulesDto;
    inserted: InsertedScheduleActivityInput[];
    updated: Array<{
      scheduleId: string;
      schedule: ScheduleRowInput;
      previousUntil: string | null;
    }>;
  }) {
    for (const insertedSchedule of input.inserted) {
      await this.publishScheduleActivity(
        input.supabase,
        input.dto,
        insertedSchedule,
        'created',
      );
    }

    for (const updatedSchedule of input.updated) {
      const nextUntil = updatedSchedule.schedule.recurrence?.until ?? null;
      if (
        nextUntil &&
        (!updatedSchedule.previousUntil || nextUntil !== updatedSchedule.previousUntil)
      ) {
        await this.publishScheduleActivity(
          input.supabase,
          input.dto,
          { scheduleId: updatedSchedule.scheduleId, schedule: updatedSchedule.schedule },
          'ended',
        );
      }
    }
  }

  private async publishScheduleActivity(
    supabase: SupabaseServiceClient,
    dto: ReplaceSchedulesDto,
    inserted: InsertedScheduleActivityInput,
    kind: 'created' | 'ended',
  ) {
    const recurrenceUntil = inserted.schedule.recurrence?.until ?? null;

    await publishActivityEvent({
      supabase,
      orgId: dto.orgId,
      eventType: kind === 'created' ? 'class.schedule.created' : 'class.schedule.ended',
      sourceKind: 'profile',
      actorProfileId: dto.createdBy,
      scope: { kind: 'learning_space', learningSpaceId: dto.learningSpaceId },
      objectRef: { kind: 'schedule', id: inserted.scheduleId },
      targetRef: { kind: 'learning_space', id: dto.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        learningSpaceId: dto.learningSpaceId,
        channelId: dto.channelId,
        scheduleId: inserted.scheduleId,
        title: dto.title,
        learningSpaceTitle: dto.title,
        channelRouteKind: 'space',
        startAt: inserted.schedule.startAt,
        endAt: inserted.schedule.endAt,
        timezone: inserted.schedule.timezone,
        recurrenceUntil,
        until: recurrenceUntil,
        members: dto.participants.map((participant) => ({
          profileId: participant.profileId,
          displayName: participant.displayName,
          avatarUrl: participant.avatarUrl,
          themeKey: participant.themeKey,
          role: participant.kind,
          kind: participant.kind,
        })),
      },
      dedupeKey: `class.schedule.${kind}:${dto.orgId}:${inserted.scheduleId}`,
      createdBy: dto.createdBy,
    });
  }

  private async insertScheduleParticipants(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleId: string,
    participants: ReplaceSchedulesDto['participants'],
    createdBy: string,
    now: string,
  ) {
    const filtered = participants;
    if (!filtered.length) return;

    const rows = filtered.map((p) => ({
      id: randomUUID(),
      org_id: orgId,
      schedule_id: scheduleId,
      profile_id: p.profileId,
      role: p.kind,
      status: 'accepted',
      display_name: p.displayName,
      avatar_url: p.avatarUrl ?? null,
      theme_key: p.themeKey ?? null,
      created_at: now,
      created_by: createdBy,
      updated_at: now,
      updated_by: createdBy,
    }));

    const { error } = await supabase.from('class_schedule_participants').insert(rows);
    if (error) throw new InternalServerErrorException(error.message);
  }

  private async insertScheduleRecurrence(
    supabase: SupabaseServiceClient,
    orgId: string,
    scheduleId: string,
    schedule: ScheduleRowInput,
    createdBy: string,
    now: string,
  ) {
    const recurrence = schedule.recurrence!;
    const recurrenceId = randomUUID();

    const { error: recurrenceError } = await supabase
      .from('class_schedule_recurrence')
      .insert({
        id: recurrenceId,
        org_id: orgId,
        schedule_id: scheduleId,
        frequency: recurrence.frequency,
        interval: recurrence.interval ?? null,
        count: recurrence.count ?? null,
        until: recurrence.until ?? null,
        timezone: recurrence.timezone ?? null,
        raw_rrule: recurrence.rawRrule ?? null,
        bysecond: recurrence.bysecond ?? null,
        byminute: recurrence.byminute ?? null,
        byhour: recurrence.byhour ?? null,
        byday: recurrence.byday ?? null,
        bymonthday: recurrence.bymonthday ?? null,
        byyearday: recurrence.byyearday ?? null,
        byweekno: recurrence.byweekno ?? null,
        bymonth: recurrence.bymonth ?? null,
        bysetpos: recurrence.bysetpos ?? null,
        wkst: recurrence.wkst ?? null,
        created_at: now,
        created_by: createdBy,
        updated_at: now,
        updated_by: createdBy,
      });

    if (recurrenceError) {
      throw new InternalServerErrorException(recurrenceError.message);
    }

    await this.replaceRecurrenceExceptionsAndOverrides(
      supabase,
      orgId,
      recurrenceId,
      recurrence.exceptions,
      recurrence.overrides,
      createdBy,
      now,
    );
  }

  /**
   * Updates an existing `class_schedule_recurrence` row in place (preserving its
   * id) instead of the insert-only path used for brand-new schedules — this is
   * what lets a recurring schedule that already has confirmations/reminder-job
   * history keep that history when its recurrence rule changes.
   */
  private async updateScheduleRecurrence(
    supabase: SupabaseServiceClient,
    orgId: string,
    recurrenceId: string,
    schedule: ScheduleRowInput,
    updatedBy: string,
    now: string,
  ) {
    const recurrence = schedule.recurrence!;

    const { error: recurrenceError } = await supabase
      .from('class_schedule_recurrence')
      .update({
        frequency: recurrence.frequency,
        interval: recurrence.interval ?? null,
        count: recurrence.count ?? null,
        until: recurrence.until ?? null,
        timezone: recurrence.timezone ?? null,
        raw_rrule: recurrence.rawRrule ?? null,
        bysecond: recurrence.bysecond ?? null,
        byminute: recurrence.byminute ?? null,
        byhour: recurrence.byhour ?? null,
        byday: recurrence.byday ?? null,
        bymonthday: recurrence.bymonthday ?? null,
        byyearday: recurrence.byyearday ?? null,
        byweekno: recurrence.byweekno ?? null,
        bymonth: recurrence.bymonth ?? null,
        bysetpos: recurrence.bysetpos ?? null,
        wkst: recurrence.wkst ?? null,
        updated_at: now,
        updated_by: updatedBy,
      })
      .eq('id', recurrenceId)
      .eq('org_id', orgId);

    if (recurrenceError) {
      throw new InternalServerErrorException(recurrenceError.message);
    }

    await this.replaceRecurrenceExceptionsAndOverrides(
      supabase,
      orgId,
      recurrenceId,
      recurrence.exceptions,
      recurrence.overrides,
      updatedBy,
      now,
    );
  }

  /** Shared by insert and update: replaces every exception/override row for a
   * recurrence id with the incoming set. Safe to delete-then-reinsert since
   * nothing outside these two tables references exception/override row ids. */
  private async replaceRecurrenceExceptionsAndOverrides(
    supabase: SupabaseServiceClient,
    orgId: string,
    recurrenceId: string,
    exceptions: RecurrenceExceptionInput[],
    overrides: RecurrenceOverrideInput[],
    actorProfileId: string,
    now: string,
  ) {
    const { error: deleteExceptionsError } = await supabase
      .from('class_schedule_recurrence_exceptions')
      .delete()
      .eq('org_id', orgId)
      .eq('recurrence_id', recurrenceId);
    if (deleteExceptionsError) {
      throw new InternalServerErrorException(deleteExceptionsError.message);
    }

    const { error: deleteOverridesError } = await supabase
      .from('class_schedule_recurrence_overrides')
      .delete()
      .eq('org_id', orgId)
      .eq('recurrence_id', recurrenceId);
    if (deleteOverridesError) {
      throw new InternalServerErrorException(deleteOverridesError.message);
    }

    if (exceptions.length) {
      const exceptionRows = exceptions.map((e) => ({
        id: randomUUID(),
        org_id: orgId,
        recurrence_id: recurrenceId,
        occurrence_key: e.occurrenceKey,
        reason: e.reason ?? null,
        created_at: now,
        created_by: actorProfileId,
        updated_at: now,
        updated_by: actorProfileId,
      }));

      const { error } = await supabase
        .from('class_schedule_recurrence_exceptions')
        .insert(exceptionRows);
      if (error) throw new InternalServerErrorException(error.message);
    }

    if (overrides.length) {
      const overrideRows = overrides.map((o) => ({
        id: randomUUID(),
        org_id: orgId,
        recurrence_id: recurrenceId,
        occurrence_key: o.occurrenceKey,
        patch: o.patch,
        created_at: now,
        created_by: actorProfileId,
        updated_at: now,
        updated_by: actorProfileId,
      }));

      const { error } = await supabase
        .from('class_schedule_recurrence_overrides')
        .insert(overrideRows);
      if (error) throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Updates a matched schedule in place instead of deleting and recreating it —
   * the core of the fix: `class_schedules.id` (and therefore anything keyed off
   * it, like `class_session_completions`) survives edits, including converting a
   * one-off session into a recurring one.
   */
  private async updateScheduleInPlace(
    supabase: SupabaseServiceClient,
    dto: ReplaceSchedulesDto,
    existingScheduleId: string,
    existingRecurrenceId: string | null,
    schedule: ScheduleRowInput,
    actorProfileId: string,
    now: string,
  ) {
    const { error: updateError } = await supabase
      .from('class_schedules')
      .update({
        title: dto.title,
        description: dto.description,
        theme_key: dto.themeKey ?? null,
        start_at: schedule.startAt,
        end_at: schedule.endAt,
        timezone: schedule.timezone,
        updated_at: now,
        updated_by: actorProfileId,
      })
      .eq('id', existingScheduleId)
      .eq('org_id', dto.orgId);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    // Participants: nothing outside this table references a participant row's
    // own id, so delete+reinsert scoped to just this schedule is safe and simple.
    const { error: deleteParticipantsError } = await supabase
      .from('class_schedule_participants')
      .delete()
      .eq('org_id', dto.orgId)
      .eq('schedule_id', existingScheduleId);
    if (deleteParticipantsError) {
      throw new InternalServerErrorException(deleteParticipantsError.message);
    }
    await this.insertScheduleParticipants(
      supabase,
      dto.orgId,
      existingScheduleId,
      dto.participants,
      actorProfileId,
      now,
    );

    if (schedule.recurrence) {
      if (existingRecurrenceId) {
        await this.updateScheduleRecurrence(
          supabase,
          dto.orgId,
          existingRecurrenceId,
          schedule,
          actorProfileId,
          now,
        );
      } else {
        await this.insertScheduleRecurrence(
          supabase,
          dto.orgId,
          existingScheduleId,
          schedule,
          actorProfileId,
          now,
        );
      }
    } else if (existingRecurrenceId) {
      // Recurrence just got turned off — exceptions/overrides cascade-delete
      // with it (ON DELETE CASCADE from class_schedule_recurrence).
      const { error: deleteRecurrenceError } = await supabase
        .from('class_schedule_recurrence')
        .delete()
        .eq('org_id', dto.orgId)
        .eq('id', existingRecurrenceId);
      if (deleteRecurrenceError) {
        throw new InternalServerErrorException(deleteRecurrenceError.message);
      }
    }
  }

  private async attachLearningSpaceArchiveMetadata(
    orgId: string,
    rows: Array<Record<string, unknown>>,
  ) {
    const learningSpaceIds = Array.from(
      new Set(
        rows
          .map((row) => row.source_learning_space_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    if (!learningSpaceIds.length) {
      return rows;
    }

    const { data, error } = await createSupabaseServiceClient()
      .from('learning_spaces')
      .select('id,status,archived_at')
      .eq('org_id', orgId)
      .in('id', learningSpaceIds);

    if (error) {
      return rows;
    }

    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return rows.map((row) => ({
      ...row,
      source_learning_space:
        typeof row.source_learning_space_id === 'string'
          ? (byId.get(row.source_learning_space_id) ?? null)
          : null,
    }));
  }
}
