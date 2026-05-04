import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import type {
  CancelSessionDto,
  DeleteSchedulesDto,
  ReplaceSchedulesDto,
  ScheduleRowInput,
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

@Injectable()
export class SchedulesService {
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
    await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();

    // Delete existing schedules for the learning space
    await this.cascadeDeleteSchedulesForLearningSpace(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
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

    return { scheduleIds };
  }

  async deleteSchedulesForLearningSpace(
    accessToken: string,
    dto: DeleteSchedulesDto,
  ): Promise<{ success: true }> {
    await this.requireOrgActor(accessToken, dto.orgId);
    const supabase = createSupabaseServiceClient();

    await this.cascadeDeleteSchedulesForLearningSpace(
      supabase,
      dto.orgId,
      dto.learningSpaceId,
    );

    return { success: true };
  }

  async cancelScheduleSession(
    accessToken: string,
    dto: CancelSessionDto,
  ): Promise<{ success: true; mode: 'single' | 'recurring' }> {
    await this.requireOrgActor(accessToken, dto.orgId);
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
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', dto.scheduleId)
        .eq('org_id', dto.orgId)
        .is('deleted_at', null);

      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }

      return { success: true, mode: 'single' };
    }

    const occurrenceKey = dto.occurrenceKey ?? '';

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
        .update({ reason: dto.reason, updated_at: now })
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
          created_at: now,
          updated_at: now,
        });

      if (insertError) {
        throw new InternalServerErrorException(insertError.message);
      }
    }

    return { success: true, mode: 'recurring' };
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
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

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
  }

  private async cascadeDeleteSchedulesForLearningSpace(
    supabase: SupabaseServiceClient,
    orgId: string,
    learningSpaceId: string,
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

    const { error: e5 } = await supabase
      .from('class_schedules')
      .delete()
      .eq('org_id', orgId)
      .in('id', scheduleIds);
    if (e5) throw new InternalServerErrorException(e5.message);
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
