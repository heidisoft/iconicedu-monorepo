import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import type {
  CancelSessionDto,
  DecideSessionChangeRequestDto,
  DeleteSchedulesDto,
  ReplaceSchedulesDto,
  RescheduleSessionDto,
  ScheduleRowInput,
  SelfServeCancelSessionDto,
  SelfServeRescheduleSessionDto,
} from '@iconicedu/api/modules/schedules/dto';
import type {
  ClassScheduleSelfServePolicyVM,
  SelfServeSessionChangeResultVM,
  SessionChangeApprovalTargetVM,
  SessionChangeRequestVM,
  SessionChangeRequestTypeVM,
} from '@iconicedu/shared-types';

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

type ExistingScheduleCompareRow = {
  id: string;
  start_at: string;
  end_at: string;
  timezone: string | null;
  recurrence: Array<{
    frequency: string | null;
    interval: number | null;
    count: number | null;
    until: string | null;
    timezone: string | null;
    byday: string[] | null;
  }> | null;
};

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

type ScheduleParticipantRole = 'educator' | 'child' | 'guardian' | 'staff' | 'observer';

type SessionActor = {
  accountId: string;
  profileId: string;
  role: ScheduleParticipantRole;
  displayName: string | null;
  roleKeys: string[];
};

type OrgMembershipActor = {
  accountId: string;
  profileId: string | null;
  roleKeys: string[];
};

type SessionChangeRequestRow = {
  id: string;
  org_id: string;
  schedule_id: string;
  occurrence_key: string | null;
  learning_space_id: string | null;
  channel_id: string | null;
  request_type: SessionChangeRequestTypeVM;
  status: string;
  requested_by_profile_id: string;
  requested_by_role: string;
  requested_note: string | null;
  current_start_at: string;
  current_end_at: string;
  requested_start_at: string | null;
  requested_end_at: string | null;
  requested_timezone: string | null;
  approval_required_from: SessionChangeApprovalTargetVM;
  decided_by_profile_id: string | null;
  decision_note: string | null;
  decided_at: string | null;
  applied_at: string | null;
  created_at: string;
};

type SelfServePolicyRow = {
  org_id: string;
  learning_space_id: string;
  enabled: boolean;
  cutoff_hours: number;
  allow_guardian: boolean;
  allow_educator: boolean;
  allow_child: boolean;
  within_cutoff_requires_approval: boolean;
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
    const previousSchedules = await this.loadExistingSchedulesForActivityComparison(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
    );

    // Delete existing schedules for the learning space
    await this.cascadeDeleteSchedulesForLearningSpace(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
      actor.profileId ?? dto.createdBy ?? null,
    );

    if (!dto.schedules.length) {
      return { scheduleIds: [] };
    }

    const scheduleIds: string[] = [];

    for (const schedule of dto.schedules) {
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

      // Participants
      await this.insertScheduleParticipants(
        supabase,
        dto.orgId,
        scheduleId,
        dto.participants,
        dto.createdBy,
        now,
      );

      // Recurrence
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
    }

    await this.publishScheduleReplacementActivities({
      supabase,
      dto,
      previousSchedules,
      insertedSchedules: scheduleIds.map((scheduleId, index) => ({
        scheduleId,
        schedule: dto.schedules[index]!,
      })),
    });

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
  ): Promise<{ success: true; mode: 'single' | 'recurring' }> {
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

  async listSessionChangeRequests(
    accessToken: string,
    input: { orgId: string; channelId?: string; scheduleId?: string },
  ): Promise<SessionChangeRequestVM[]> {
    const actor = await this.requireOrgMembershipActor(accessToken, input.orgId);
    const supabase = createSupabaseServiceClient();
    const isManager = actor.roleKeys.some((role) =>
      ['owner', 'admin', 'staff'].includes(role),
    );
    const participantScheduleIds = isManager
      ? []
      : await this.listParticipantScheduleIdsForActor(supabase, {
          orgId: input.orgId,
          profileId: actor.profileId,
          scheduleId: input.scheduleId,
        });

    if (!isManager && participantScheduleIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('class_session_change_requests')
      .select('*')
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (input.channelId) query = query.eq('channel_id', input.channelId);
    if (input.scheduleId) query = query.eq('schedule_id', input.scheduleId);
    if (!isManager) query = query.in('schedule_id', participantScheduleIds);

    const { data, error } = await query.returns<SessionChangeRequestRow[]>();
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map(this.mapSessionChangeRequest);
  }

  async selfServeCancelSession(
    accessToken: string,
    dto: SelfServeCancelSessionDto,
  ): Promise<SelfServeSessionChangeResultVM> {
    return this.handleSelfServeSessionChange(accessToken, {
      ...dto,
      type: 'cancel',
      startAt: null,
      endAt: null,
      timezone: null,
    });
  }

  async selfServeRescheduleSession(
    accessToken: string,
    dto: SelfServeRescheduleSessionDto,
  ): Promise<SelfServeSessionChangeResultVM> {
    const startMs = new Date(dto.startAt).getTime();
    const endMs = new Date(dto.endAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new BadRequestException('startAt and endAt must be valid dates');
    }
    if (endMs <= startMs) {
      throw new BadRequestException('endAt must be after startAt');
    }
    return this.handleSelfServeSessionChange(accessToken, {
      ...dto,
      type: 'reschedule',
      note: dto.note,
    });
  }

  async approveSessionChangeRequest(
    accessToken: string,
    requestId: string,
    dto: DecideSessionChangeRequestDto,
  ): Promise<SelfServeSessionChangeResultVM> {
    if (!requestId) throw new BadRequestException('request id is required');
    const supabase = createSupabaseServiceClient();
    const request = await this.loadSessionChangeRequest(supabase, requestId);
    if (!request || request.status !== 'pending') {
      throw new BadRequestException('Pending change request not found');
    }

    const actor = await this.requireSessionParticipantActor(accessToken, {
      orgId: request.org_id,
      scheduleId: request.schedule_id,
    });
    this.assertCanApproveRequest(actor, request);

    const now = new Date().toISOString();
    const mode =
      request.request_type === 'cancel'
        ? await this.applyCancelForActor({
            supabase,
            orgId: request.org_id,
            scheduleId: request.schedule_id,
            occurrenceKey: request.occurrence_key,
            note: this.buildChangeNote({
              action: 'approved cancellation',
              actor,
              note: request.requested_note,
              decisionNote: dto.note,
            }),
            actorProfileId: actor.profileId,
          })
        : await this.applyRescheduleForActor({
            supabase,
            orgId: request.org_id,
            scheduleId: request.schedule_id,
            occurrenceKey: request.occurrence_key,
            startAt: request.requested_start_at!,
            endAt: request.requested_end_at!,
            timezone: request.requested_timezone,
            note: this.buildChangeNote({
              action: 'approved reschedule',
              actor,
              note: request.requested_note,
              decisionNote: dto.note,
            }),
            actorProfileId: actor.profileId,
          });

    const { data, error } = await supabase
      .from('class_session_change_requests')
      .update({
        status: 'applied',
        decision_note: dto.note,
        decided_by_profile_id: actor.profileId,
        decided_at: now,
        applied_at: now,
        updated_at: now,
        updated_by: actor.profileId,
      })
      .eq('id', request.id)
      .eq('org_id', request.org_id)
      .select('*')
      .single<SessionChangeRequestRow>();
    if (error) throw new InternalServerErrorException(error.message);

    await this.publishSessionChangeRequestDecisionActivity({
      supabase,
      request: data,
      actor,
      approved: true,
    });

    return {
      status: 'applied',
      request: this.mapSessionChangeRequest(data),
      mode,
      approvalRequired: false,
    };
  }

  async rejectSessionChangeRequest(
    accessToken: string,
    requestId: string,
    dto: DecideSessionChangeRequestDto,
  ): Promise<SelfServeSessionChangeResultVM> {
    if (!requestId) throw new BadRequestException('request id is required');
    const supabase = createSupabaseServiceClient();
    const request = await this.loadSessionChangeRequest(supabase, requestId);
    if (!request || request.status !== 'pending') {
      throw new BadRequestException('Pending change request not found');
    }

    const actor = await this.requireSessionParticipantActor(accessToken, {
      orgId: request.org_id,
      scheduleId: request.schedule_id,
    });
    this.assertCanApproveRequest(actor, request);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('class_session_change_requests')
      .update({
        status: 'rejected',
        decision_note: dto.note,
        decided_by_profile_id: actor.profileId,
        decided_at: now,
        updated_at: now,
        updated_by: actor.profileId,
      })
      .eq('id', request.id)
      .eq('org_id', request.org_id)
      .select('*')
      .single<SessionChangeRequestRow>();
    if (error) throw new InternalServerErrorException(error.message);

    await this.publishSessionChangeRequestDecisionActivity({
      supabase,
      request: data,
      actor,
      approved: false,
    });

    return {
      status: 'rejected',
      request: this.mapSessionChangeRequest(data),
      mode: null,
      approvalRequired: false,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private mapSessionChangeRequest(row: SessionChangeRequestRow): SessionChangeRequestVM {
    return {
      id: row.id,
      orgId: row.org_id,
      scheduleId: row.schedule_id,
      occurrenceKey: row.occurrence_key,
      learningSpaceId: row.learning_space_id,
      channelId: row.channel_id,
      type: row.request_type,
      status: row.status as SessionChangeRequestVM['status'],
      requestedByProfileId: row.requested_by_profile_id,
      requestedByRole: row.requested_by_role,
      requestedNote: row.requested_note,
      currentStartAt: row.current_start_at,
      currentEndAt: row.current_end_at,
      requestedStartAt: row.requested_start_at,
      requestedEndAt: row.requested_end_at,
      requestedTimezone: row.requested_timezone,
      approvalRequiredFrom: row.approval_required_from,
      decidedByProfileId: row.decided_by_profile_id,
      decisionNote: row.decision_note,
      decidedAt: row.decided_at,
      appliedAt: row.applied_at,
      createdAt: row.created_at,
    };
  }

  private async handleSelfServeSessionChange(
    accessToken: string,
    input: {
      orgId: string;
      scheduleId: string;
      occurrenceKey: string | null;
      type: SessionChangeRequestTypeVM;
      startAt: string | null;
      endAt: string | null;
      timezone: string | null;
      note: string | null;
    },
  ): Promise<SelfServeSessionChangeResultVM> {
    const supabase = createSupabaseServiceClient();
    const actor = await this.requireSessionParticipantActor(accessToken, input);
    const context = await this.loadRescheduleActivityContext(
      supabase,
      input.orgId,
      input.scheduleId,
    );
    if (!context?.learningSpaceId) {
      throw new BadRequestException('Class session not found');
    }

    await this.assertLearningSpaceActive(supabase, input.orgId, context.learningSpaceId);

    const policy = await this.loadSelfServePolicy(
      supabase,
      input.orgId,
      context.learningSpaceId,
    );
    this.assertPolicyAllowsActor(policy, actor);

    const currentStartAt = input.occurrenceKey ?? context.startAt;
    const currentEndAt =
      input.occurrenceKey && input.occurrenceKey !== context.startAt
        ? (this.shiftOccurrenceEnd(input.occurrenceKey, context) ?? context.endAt)
        : context.endAt;
    this.assertFutureSession(currentStartAt);
    if (input.type === 'reschedule' && (!input.startAt || !input.endAt)) {
      throw new BadRequestException('startAt and endAt are required');
    }

    const requiresApproval =
      policy.withinCutoffRequiresApproval &&
      this.isWithinCutoff(currentStartAt, policy.cutoffHours);
    const note = this.buildChangeNote({
      action: input.type === 'cancel' ? 'canceled' : 'rescheduled',
      actor,
      note: input.note,
    });

    if (!requiresApproval) {
      const mode =
        input.type === 'cancel'
          ? await this.applyCancelForActor({
              supabase,
              orgId: input.orgId,
              scheduleId: input.scheduleId,
              occurrenceKey: input.occurrenceKey,
              note,
              actorProfileId: actor.profileId,
            })
          : await this.applyRescheduleForActor({
              supabase,
              orgId: input.orgId,
              scheduleId: input.scheduleId,
              occurrenceKey: input.occurrenceKey,
              startAt: input.startAt!,
              endAt: input.endAt!,
              timezone: input.timezone,
              note,
              actorProfileId: actor.profileId,
            });

      return { status: 'applied', request: null, mode, approvalRequired: false };
    }

    const request = await this.createSessionChangeRequest({
      supabase,
      actor,
      context,
      input,
      currentStartAt,
      currentEndAt,
      approvalRequiredFrom: this.resolveApprovalTarget(actor.role),
    });
    await this.publishSessionChangeRequestActivity({ supabase, request, actor });

    return {
      status: 'pending',
      request: this.mapSessionChangeRequest(request),
      mode: null,
      approvalRequired: true,
    };
  }

  private async requireOrgMembership(accessToken: string, orgId: string) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();
    if (userError || !user) throw new UnauthorizedException('Unauthorized');

    const { data, error } = await createSupabaseServiceClient()
      .from('accounts')
      .select('id, active_profile_id')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; active_profile_id: string | null }>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new ForbiddenException('Not a member of this organization');
    return data;
  }

  private async requireOrgMembershipActor(
    accessToken: string,
    orgId: string,
  ): Promise<OrgMembershipActor> {
    const account = await this.requireOrgMembership(accessToken, orgId);
    const profileId =
      account.active_profile_id ??
      (await this.resolveFallbackActorProfileId(orgId, account.id));

    const { data: roles, error } = await createSupabaseServiceClient()
      .from('user_roles')
      .select('role_key')
      .eq('account_id', account.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<Array<{ role_key: string | null }>>();
    if (error) throw new InternalServerErrorException(error.message);

    return {
      accountId: account.id,
      profileId,
      roleKeys: (roles ?? [])
        .map((role) => role.role_key)
        .filter((role): role is string => Boolean(role)),
    };
  }

  private async listParticipantScheduleIdsForActor(
    supabase: SupabaseServiceClient,
    input: {
      orgId: string;
      profileId: string | null;
      scheduleId?: string;
    },
  ) {
    if (!input.profileId) return [];

    let query = supabase
      .from('class_schedule_participants')
      .select('schedule_id')
      .eq('org_id', input.orgId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null);

    if (input.scheduleId) {
      query = query.eq('schedule_id', input.scheduleId);
    }

    const { data, error } = await query.returns<Array<{ schedule_id: string }>>();
    if (error) throw new InternalServerErrorException(error.message);

    return Array.from(
      new Set((data ?? []).map((row) => row.schedule_id).filter(Boolean)),
    );
  }

  private async requireSessionParticipantActor(
    accessToken: string,
    input: { orgId: string; scheduleId: string },
  ): Promise<SessionActor> {
    const account = await this.requireOrgMembership(accessToken, input.orgId);
    const profileId =
      account.active_profile_id ??
      (await this.resolveFallbackActorProfileId(input.orgId, account.id));
    if (!profileId) throw new ForbiddenException('Active profile is required');

    const supabase = createSupabaseServiceClient();
    const { data: participant, error } = await supabase
      .from('class_schedule_participants')
      .select('role, display_name')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .maybeSingle<{ role: ScheduleParticipantRole; display_name: string | null }>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!participant) {
      throw new ForbiddenException('Only class participants can change this session');
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('account_id', account.id)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .returns<Array<{ role_key: string | null }>>();
    if (rolesError) throw new InternalServerErrorException(rolesError.message);

    return {
      accountId: account.id,
      profileId,
      role: participant.role,
      displayName: participant.display_name,
      roleKeys: (roles ?? [])
        .map((role) => role.role_key)
        .filter((role): role is string => Boolean(role)),
    };
  }

  private async loadSelfServePolicy(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
  ): Promise<ClassScheduleSelfServePolicyVM> {
    const { data, error } = await supabase
      .from('class_schedule_self_serve_policies')
      .select('*')
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId)
      .is('deleted_at', null)
      .maybeSingle<SelfServePolicyRow>();
    if (error) throw new InternalServerErrorException(error.message);

    return {
      orgId,
      learningSpaceId,
      enabled: data?.enabled ?? true,
      cutoffHours: data?.cutoff_hours ?? 48,
      allowGuardian: data?.allow_guardian ?? true,
      allowEducator: data?.allow_educator ?? true,
      allowChild: data?.allow_child ?? true,
      withinCutoffRequiresApproval: data?.within_cutoff_requires_approval ?? true,
    };
  }

  private assertPolicyAllowsActor(
    policy: ClassScheduleSelfServePolicyVM,
    actor: SessionActor,
  ) {
    if (!policy.enabled) throw new ForbiddenException('Self-serve changes are disabled');
    if (actor.role === 'guardian' && !policy.allowGuardian) {
      throw new ForbiddenException('Guardians cannot self-serve this class');
    }
    if (actor.role === 'educator' && !policy.allowEducator) {
      throw new ForbiddenException('Educators cannot self-serve this class');
    }
    if (actor.role === 'child' && !policy.allowChild) {
      throw new ForbiddenException('Students cannot self-serve this class');
    }
    if (!['guardian', 'educator', 'child', 'staff'].includes(actor.role)) {
      throw new ForbiddenException('This participant cannot self-serve sessions');
    }
  }

  private async assertLearningSpaceActive(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
  ) {
    const { data, error } = await supabase
      .from('learning_spaces')
      .select('status, archived_at')
      .eq('id', learningSpaceId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ status: string | null; archived_at: string | null }>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.archived_at || data.status === 'archived') {
      throw new ForbiddenException('Archived classrooms cannot be changed');
    }
  }

  private assertFutureSession(startAt: string) {
    if (new Date(startAt).getTime() <= Date.now()) {
      throw new BadRequestException('Past or live sessions cannot be changed');
    }
  }

  private isWithinCutoff(startAt: string, cutoffHours: number) {
    return new Date(startAt).getTime() - Date.now() < cutoffHours * 60 * 60 * 1000;
  }

  private resolveApprovalTarget(
    role: ScheduleParticipantRole,
  ): SessionChangeApprovalTargetVM {
    if (role === 'educator') return 'guardian';
    if (role === 'guardian') return 'educator';
    if (role === 'child') return 'either_adult';
    return 'staff';
  }

  private buildChangeNote(input: {
    action: string;
    actor: SessionActor;
    note: string | null;
    decisionNote?: string | null;
  }) {
    const actorName = input.actor.displayName ?? input.actor.profileId;
    const parts = [`${input.action} by ${actorName} (${input.actor.role})`];
    if (input.note) parts.push(`Note: ${input.note}`);
    if (input.decisionNote) parts.push(`Decision note: ${input.decisionNote}`);
    return parts.join('. ');
  }

  private async createSessionChangeRequest(input: {
    supabase: SupabaseServiceClient;
    actor: SessionActor;
    context: RescheduleActivityContext;
    input: {
      orgId: string;
      scheduleId: string;
      occurrenceKey: string | null;
      type: SessionChangeRequestTypeVM;
      startAt: string | null;
      endAt: string | null;
      timezone: string | null;
      note: string | null;
    };
    currentStartAt: string;
    currentEndAt: string;
    approvalRequiredFrom: SessionChangeApprovalTargetVM;
  }) {
    const now = new Date().toISOString();
    const { data, error } = await input.supabase
      .from('class_session_change_requests')
      .insert({
        org_id: input.input.orgId,
        schedule_id: input.input.scheduleId,
        occurrence_key: input.input.occurrenceKey,
        learning_space_id: input.context.learningSpaceId,
        channel_id: input.context.channelId,
        request_type: input.input.type,
        status: 'pending',
        requested_by_profile_id: input.actor.profileId,
        requested_by_role: input.actor.role,
        requested_note: input.input.note,
        current_start_at: input.currentStartAt,
        current_end_at: input.currentEndAt,
        requested_start_at: input.input.startAt,
        requested_end_at: input.input.endAt,
        requested_timezone: input.input.timezone,
        approval_required_from: input.approvalRequiredFrom,
        created_at: now,
        created_by: input.actor.profileId,
        updated_at: now,
        updated_by: input.actor.profileId,
      })
      .select('*')
      .single<SessionChangeRequestRow>();

    if (error) {
      throw new BadRequestException(
        error.message.includes('class_session_change_requests_one_pending')
          ? 'A pending change request already exists for this session'
          : error.message,
      );
    }

    return data;
  }

  private async loadSessionChangeRequest(
    supabase: SupabaseServiceClient,
    requestId: string,
  ) {
    const { data, error } = await supabase
      .from('class_session_change_requests')
      .select('*')
      .eq('id', requestId)
      .is('deleted_at', null)
      .maybeSingle<SessionChangeRequestRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private assertCanApproveRequest(actor: SessionActor, request: SessionChangeRequestRow) {
    if (actor.profileId === request.requested_by_profile_id) {
      throw new ForbiddenException('Requester cannot approve their own change request');
    }
    const isManager = actor.roleKeys.some((role) =>
      ['owner', 'admin', 'staff'].includes(role),
    );
    if (isManager || request.approval_required_from === 'staff') {
      if (isManager) return;
    }
    if (request.approval_required_from === 'educator' && actor.role === 'educator') {
      return;
    }
    if (request.approval_required_from === 'guardian' && actor.role === 'guardian') {
      return;
    }
    if (
      request.approval_required_from === 'either_adult' &&
      (actor.role === 'guardian' || actor.role === 'educator')
    ) {
      return;
    }
    throw new ForbiddenException('Actor cannot approve this change request');
  }

  private async applyCancelForActor(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    scheduleId: string;
    occurrenceKey: string | null;
    note: string | null;
    actorProfileId: string;
  }): Promise<'single' | 'recurring'> {
    const context = await this.loadRescheduleActivityContext(
      input.supabase,
      input.orgId,
      input.scheduleId,
    );
    const { data: recurrenceRow, error: recurrenceError } = await input.supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (recurrenceError) throw new InternalServerErrorException(recurrenceError.message);

    const now = new Date().toISOString();
    if (!recurrenceRow) {
      const { error } = await input.supabase
        .from('class_schedules')
        .update({
          status: 'cancelled',
          updated_at: now,
          updated_by: input.actorProfileId,
        })
        .eq('id', input.scheduleId)
        .eq('org_id', input.orgId)
        .is('deleted_at', null);
      if (error) throw new InternalServerErrorException(error.message);
      await this.publishSessionCanceledActivity({
        supabase: input.supabase,
        orgId: input.orgId,
        actorProfileId: input.actorProfileId,
        context,
        canceledStartAt: context?.startAt ?? null,
        canceledEndAt: context?.endAt ?? null,
        reason: input.note,
        dedupeKey: `class.session.canceled:${input.orgId}:${input.scheduleId}:${context?.startAt ?? 'single'}`,
      });
      await this.reconcileRemindersForSchedule(input.orgId, input.scheduleId);
      return 'single';
    }

    if (!input.occurrenceKey) {
      throw new BadRequestException('occurrenceKey is required for recurring sessions');
    }
    await input.supabase
      .from('class_schedule_recurrence_overrides')
      .delete()
      .eq('org_id', input.orgId)
      .eq('recurrence_id', recurrenceRow.id)
      .eq('occurrence_key', input.occurrenceKey);

    const { error } = await input.supabase
      .from('class_schedule_recurrence_exceptions')
      .insert({
        id: randomUUID(),
        org_id: input.orgId,
        recurrence_id: recurrenceRow.id,
        occurrence_key: input.occurrenceKey,
        reason: input.note,
        suppress_notifications: false,
        created_at: now,
        created_by: input.actorProfileId,
        updated_at: now,
        updated_by: input.actorProfileId,
      });
    if (error) throw new InternalServerErrorException(error.message);
    await this.publishSessionCanceledActivity({
      supabase: input.supabase,
      orgId: input.orgId,
      actorProfileId: input.actorProfileId,
      context,
      canceledStartAt: input.occurrenceKey,
      canceledEndAt: this.shiftOccurrenceEnd(input.occurrenceKey, context),
      reason: input.note,
      dedupeKey: `class.session.canceled:${input.orgId}:${input.scheduleId}:${input.occurrenceKey}`,
    });
    await this.reconcileRemindersForSchedule(input.orgId, input.scheduleId);
    return 'recurring';
  }

  private async applyRescheduleForActor(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    scheduleId: string;
    occurrenceKey: string | null;
    startAt: string;
    endAt: string;
    timezone: string | null;
    note: string | null;
    actorProfileId: string;
  }): Promise<'single' | 'recurring'> {
    const previousContext = await this.loadRescheduleActivityContext(
      input.supabase,
      input.orgId,
      input.scheduleId,
    );
    const mode = await this.rescheduleScheduleSessionAsActor(input);
    await this.publishSessionRescheduledActivity({
      supabase: input.supabase,
      orgId: input.orgId,
      actorProfileId: input.actorProfileId,
      context: previousContext,
      oldStartAt: input.occurrenceKey ?? previousContext?.startAt ?? null,
      oldEndAt:
        input.occurrenceKey && input.occurrenceKey !== previousContext?.startAt
          ? this.shiftOccurrenceEnd(input.occurrenceKey, previousContext)
          : (previousContext?.endAt ?? null),
      newStartAt: input.startAt,
      newEndAt: input.endAt,
      reason: input.note,
      suppressNotifications: false,
      dedupeKey: `class.session.rescheduled:${input.orgId}:${input.scheduleId}:${input.occurrenceKey ?? previousContext?.startAt ?? input.startAt}`,
    });
    await this.reconcileRemindersForSchedule(input.orgId, input.scheduleId);
    return mode;
  }

  private async rescheduleScheduleSessionAsActor(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    scheduleId: string;
    occurrenceKey: string | null;
    startAt: string;
    endAt: string;
    timezone: string | null;
    note: string | null;
    actorProfileId: string;
  }): Promise<'single' | 'recurring'> {
    const now = new Date().toISOString();
    const { data: recurrenceRow, error: recurrenceError } = await input.supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (recurrenceError) throw new InternalServerErrorException(recurrenceError.message);

    if (!recurrenceRow) {
      const { error } = await input.supabase
        .from('class_schedules')
        .update({
          start_at: input.startAt,
          end_at: input.endAt,
          timezone: input.timezone,
          updated_at: now,
          updated_by: input.actorProfileId,
        })
        .eq('id', input.scheduleId)
        .eq('org_id', input.orgId)
        .is('deleted_at', null);
      if (error) throw new InternalServerErrorException(error.message);
      return 'single';
    }

    if (!input.occurrenceKey) {
      throw new BadRequestException('occurrenceKey is required for recurring sessions');
    }

    await input.supabase
      .from('class_schedule_recurrence_exceptions')
      .delete()
      .eq('org_id', input.orgId)
      .eq('recurrence_id', recurrenceRow.id)
      .eq('occurrence_key', input.occurrenceKey);

    const patch = {
      startAt: input.startAt,
      endAt: input.endAt,
      ...(input.note ? { reason: input.note } : {}),
    };
    const existingOverrides = await this.loadActiveOverridesForOccurrence({
      supabase: input.supabase,
      orgId: input.orgId,
      recurrenceId: recurrenceRow.id,
      occurrenceKey: input.occurrenceKey,
    });
    const existingOverride = existingOverrides[0] ?? null;

    if (existingOverride) {
      const { error } = await input.supabase
        .from('class_schedule_recurrence_overrides')
        .update({
          patch,
          suppress_notifications: false,
          updated_at: now,
          updated_by: input.actorProfileId,
        })
        .eq('id', existingOverride.id)
        .eq('org_id', input.orgId);
      if (error) throw new InternalServerErrorException(error.message);
    } else {
      const { error } = await input.supabase
        .from('class_schedule_recurrence_overrides')
        .insert({
          id: randomUUID(),
          org_id: input.orgId,
          recurrence_id: recurrenceRow.id,
          occurrence_key: input.occurrenceKey,
          patch,
          suppress_notifications: false,
          created_at: now,
          created_by: input.actorProfileId,
          updated_at: now,
          updated_by: input.actorProfileId,
        });
      if (error) throw new InternalServerErrorException(error.message);
    }

    const duplicateOverrideIds = existingOverrides
      .slice(1)
      .map((override) => override.id);
    if (duplicateOverrideIds.length) {
      await this.deleteDuplicateOverrides({
        supabase: input.supabase,
        orgId: input.orgId,
        duplicateOverrideIds,
      });
    }
    return 'recurring';
  }

  private async publishSessionCanceledActivity(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    actorProfileId: string | null;
    context: RescheduleActivityContext | null;
    canceledStartAt: string | null;
    canceledEndAt: string | null;
    reason: string | null;
    dedupeKey: string;
  }) {
    if (!input.context?.learningSpaceId || !input.context.channelId) return;

    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'class.session.canceled',
      sourceKind: input.actorProfileId ? 'profile' : 'system',
      actorProfileId: input.actorProfileId,
      scope: {
        kind: 'learning_space',
        learningSpaceId: input.context.learningSpaceId,
      },
      objectRef: {
        kind: 'session',
        id: input.canceledStartAt ?? input.context.scheduleId,
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
        startAt: input.canceledStartAt,
        endAt: input.canceledEndAt,
        canceledStartAt: input.canceledStartAt,
        canceledEndAt: input.canceledEndAt,
        canceledReason: input.reason,
        reason: input.reason,
        timezone: input.context.timezone,
        members: input.context.members,
      },
      dedupeKey: input.dedupeKey,
      refreshOnDedupe: true,
      createdBy: input.actorProfileId,
    });
  }

  private async publishSessionChangeRequestActivity(input: {
    supabase: SupabaseServiceClient;
    request: SessionChangeRequestRow;
    actor: SessionActor;
  }) {
    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.request.org_id,
      eventType:
        input.request.request_type === 'cancel'
          ? 'class.session.cancel_requested'
          : 'class.session.reschedule_requested',
      sourceKind: 'profile',
      actorProfileId: input.actor.profileId,
      scope: input.request.learning_space_id
        ? { kind: 'learning_space', learningSpaceId: input.request.learning_space_id }
        : { kind: 'global' },
      objectRef: { kind: 'session_change_request', id: input.request.id },
      targetRef: input.request.learning_space_id
        ? { kind: 'learning_space', id: input.request.learning_space_id }
        : null,
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        requestId: input.request.id,
        scheduleId: input.request.schedule_id,
        channelId: input.request.channel_id,
        learningSpaceId: input.request.learning_space_id,
        title: 'Session change request',
        requestType: input.request.request_type,
        requestedByProfileId: input.actor.profileId,
        requestedByName: input.actor.displayName,
        requestedByRole: input.actor.role,
        requestedNote: input.request.requested_note,
        approvalRequiredFrom: input.request.approval_required_from,
        startAt: input.request.current_start_at,
        endAt: input.request.current_end_at,
        requestedStartAt: input.request.requested_start_at,
        requestedEndAt: input.request.requested_end_at,
        requestedTimezone: input.request.requested_timezone,
        timezone: input.request.requested_timezone,
      },
      dedupeKey: `class.session.change_request:${input.request.id}:created`,
      createdBy: input.actor.profileId,
    });
  }

  private async publishSessionChangeRequestDecisionActivity(input: {
    supabase: SupabaseServiceClient;
    request: SessionChangeRequestRow;
    actor: SessionActor;
    approved: boolean;
  }) {
    await publishActivityEvent({
      supabase: input.supabase,
      orgId: input.request.org_id,
      eventType: input.approved
        ? 'class.session.change_request.approved'
        : 'class.session.change_request.rejected',
      sourceKind: 'profile',
      actorProfileId: input.actor.profileId,
      scope: input.request.learning_space_id
        ? { kind: 'learning_space', learningSpaceId: input.request.learning_space_id }
        : { kind: 'global' },
      objectRef: { kind: 'session_change_request', id: input.request.id },
      targetRef: input.request.learning_space_id
        ? { kind: 'learning_space', id: input.request.learning_space_id }
        : null,
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        requestId: input.request.id,
        scheduleId: input.request.schedule_id,
        channelId: input.request.channel_id,
        learningSpaceId: input.request.learning_space_id,
        title: input.approved ? 'Session change approved' : 'Session change declined',
        requestType: input.request.request_type,
        requestedByProfileId: input.request.requested_by_profile_id,
        requestedByRole: input.request.requested_by_role,
        decidedByProfileId: input.actor.profileId,
        decidedByName: input.actor.displayName,
        decisionNote: input.request.decision_note,
        startAt: input.request.current_start_at,
        endAt: input.request.current_end_at,
        requestedStartAt: input.request.requested_start_at,
        requestedEndAt: input.request.requested_end_at,
        requestedTimezone: input.request.requested_timezone,
        timezone: input.request.requested_timezone,
      },
      dedupeKey: `class.session.change_request:${input.request.id}:${input.approved ? 'approved' : 'rejected'}`,
      createdBy: input.actor.profileId,
    });
  }

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

    const scheduleIds = (existingSchedules ?? []).map((r) => r.id);
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

    const { data: completionVoteRows, error: completionVotesError } = await supabase
      .from('class_session_completion_votes')
      .select('schedule_id')
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds)
      .returns<Array<{ schedule_id: string }>>();

    if (completionVotesError) {
      throw new InternalServerErrorException(completionVotesError.message);
    }

    const referencedScheduleIds = new Set(
      (completionVoteRows ?? []).map((row) => row.schedule_id),
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

  private async loadExistingSchedulesForActivityComparison(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
  ) {
    const { data, error } = await supabase
      .from('class_schedules')
      .select(
        `
          id, start_at, end_at, timezone,
          recurrence:class_schedule_recurrence(
            frequency, interval, count, until, timezone, byday
          )
        `,
      )
      .eq('org_id', orgId)
      .eq('source_learning_space_id', learningSpaceId)
      .eq('source_kind', 'class_session')
      .is('deleted_at', null)
      .returns<ExistingScheduleCompareRow[]>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
  }

  private buildScheduleActivitySignature(
    schedule:
      | ScheduleRowInput
      | Pick<
          ExistingScheduleCompareRow,
          'start_at' | 'end_at' | 'timezone' | 'recurrence'
        >,
  ) {
    const isInput = 'startAt' in schedule;
    const recurrence = isInput ? schedule.recurrence : (schedule.recurrence?.[0] ?? null);
    return JSON.stringify({
      startAt: isInput ? schedule.startAt : schedule.start_at,
      endAt: isInput ? schedule.endAt : schedule.end_at,
      timezone: isInput ? schedule.timezone : (schedule.timezone ?? null),
      recurrence: recurrence
        ? {
            frequency: recurrence.frequency,
            interval: recurrence.interval ?? null,
            timezone: recurrence.timezone ?? null,
            byday: [...(recurrence.byday ?? [])].sort(),
          }
        : null,
    });
  }

  private getScheduleRecurrenceUntil(
    schedule: ScheduleRowInput | ExistingScheduleCompareRow,
  ) {
    if ('startAt' in schedule) {
      return schedule.recurrence?.until ?? null;
    }
    return schedule.recurrence?.[0]?.until ?? null;
  }

  private async publishScheduleReplacementActivities(input: {
    supabase: SupabaseServiceClient;
    dto: ReplaceSchedulesDto;
    previousSchedules: ExistingScheduleCompareRow[];
    insertedSchedules: InsertedScheduleActivityInput[];
  }) {
    const previousBySignature = new Map<string, ExistingScheduleCompareRow[]>();
    for (const previous of input.previousSchedules) {
      const signature = this.buildScheduleActivitySignature(previous);
      previousBySignature.set(signature, [
        ...(previousBySignature.get(signature) ?? []),
        previous,
      ]);
    }

    for (const inserted of input.insertedSchedules) {
      const signature = this.buildScheduleActivitySignature(inserted.schedule);
      const matchedPrevious = previousBySignature.get(signature)?.shift() ?? null;
      if (!matchedPrevious) {
        await this.publishScheduleActivity(
          input.supabase,
          input.dto,
          inserted,
          'created',
        );
        continue;
      }

      const previousUntil = this.getScheduleRecurrenceUntil(matchedPrevious);
      const nextUntil = this.getScheduleRecurrenceUntil(inserted.schedule);
      if (nextUntil && (!previousUntil || nextUntil !== previousUntil)) {
        await this.publishScheduleActivity(input.supabase, input.dto, inserted, 'ended');
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

    if (recurrence.exceptions.length) {
      const exceptionRows = recurrence.exceptions.map((e) => ({
        id: randomUUID(),
        org_id: orgId,
        recurrence_id: recurrenceId,
        occurrence_key: e.occurrenceKey,
        reason: e.reason ?? null,
        created_at: now,
        created_by: createdBy,
        updated_at: now,
        updated_by: createdBy,
      }));

      const { error } = await supabase
        .from('class_schedule_recurrence_exceptions')
        .insert(exceptionRows);
      if (error) throw new InternalServerErrorException(error.message);
    }

    if (recurrence.overrides.length) {
      const overrideRows = recurrence.overrides.map((o) => ({
        id: randomUUID(),
        org_id: orgId,
        recurrence_id: recurrenceId,
        occurrence_key: o.occurrenceKey,
        patch: o.patch,
        created_at: now,
        created_by: createdBy,
        updated_at: now,
        updated_by: createdBy,
      }));

      const { error } = await supabase
        .from('class_schedule_recurrence_overrides')
        .insert(overrideRows);
      if (error) throw new InternalServerErrorException(error.message);
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
