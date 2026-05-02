import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

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
