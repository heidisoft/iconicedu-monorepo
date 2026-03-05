import type { SupabaseClient } from '@supabase/supabase-js';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { cancelLearningSpaceReminderJobs } from '@iconicedu/web/lib/automation/reminder-jobs';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function deleteLearningSpaceCascade(learningSpaceId: string) {
  const { supabase, orgId } = await requireAdminAuthContext();

  const { data: learningSpace, error: learningSpaceError } = await supabase
    .from('learning_spaces')
    .select('id, org_id')
    .eq('id', learningSpaceId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (learningSpaceError) {
    throw new Error(learningSpaceError.message);
  }

  if (!learningSpace) {
    throw new Error('Learning space not found');
  }

  const { data: channelRows, error: channelError } = await supabase
    .from('learning_space_channels')
    .select('channel_id')
    .eq('org_id', orgId)
    .eq('learning_space_id', learningSpaceId)
    .is('deleted_at', null);

  if (channelError) {
    throw new Error(channelError.message);
  }

  const channelIds = (channelRows ?? []).map((row) => row.channel_id).filter(Boolean);

  const { data: scheduleRows, error: scheduleError } = await supabase
    .from('class_schedules')
    .select('id')
    .eq('org_id', orgId)
    .eq('source_learning_space_id', learningSpaceId)
    .is('deleted_at', null);

  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  const scheduleIds = (scheduleRows ?? []).map((row) => row.id).filter(Boolean);

  await cancelLearningSpaceReminderJobs({
    supabase: createSupabaseServiceClient(),
    orgId,
    learningSpaceId,
  });

  await deleteSchedules(supabase, orgId, scheduleIds);
  await deleteChannels(supabase, orgId, learningSpaceId, channelIds);
  await deleteLearningSpaceRelations(supabase, orgId, learningSpaceId);
}

async function deleteSchedules(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
) {
  if (!scheduleIds.length) {
    return;
  }

  const { data: recurrenceRows, error: recurrenceError } = await supabase
    .from('class_schedule_recurrence')
    .select('id')
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .is('deleted_at', null);

  if (recurrenceError) {
    throw new Error(recurrenceError.message);
  }

  const recurrenceIds = (recurrenceRows ?? []).map((row) => row.id).filter(Boolean);

  if (recurrenceIds.length) {
    await ensureDeleted(
      supabase
        .from('class_schedule_recurrence_exceptions')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds),
    );

    await ensureDeleted(
      supabase
        .from('class_schedule_recurrence_overrides')
        .delete()
        .eq('org_id', orgId)
        .in('recurrence_id', recurrenceIds),
    );
  }

  await ensureDeleted(
    supabase
      .from('class_schedule_recurrence')
      .delete()
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds),
  );

  await ensureDeleted(
    supabase
      .from('class_schedule_participants')
      .delete()
      .eq('org_id', orgId)
      .in('schedule_id', scheduleIds),
  );

  await ensureDeleted(
    supabase.from('class_schedules').delete().eq('org_id', orgId).in('id', scheduleIds),
  );
}

async function deleteChannels(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return;
  }

  await ensureDeleted(
    supabase
      .from('learning_space_channels')
      .delete()
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId)
      .in('channel_id', channelIds),
  );

  await ensureDeleted(
    supabase
      .from('channel_read_states')
      .delete()
      .eq('org_id', orgId)
      .in('channel_id', channelIds),
  );

  await ensureDeleted(
    supabase
      .from('channel_capabilities')
      .delete()
      .eq('org_id', orgId)
      .in('channel_id', channelIds),
  );

  await ensureDeleted(
    supabase
      .from('channel_members')
      .delete()
      .eq('org_id', orgId)
      .in('channel_id', channelIds),
  );

  await ensureDeleted(
    supabase.from('channels').delete().eq('org_id', orgId).in('id', channelIds),
  );
}

async function deleteLearningSpaceRelations(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceId: string,
) {
  await ensureDeleted(
    supabase
      .from('learning_space_participants')
      .delete()
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId),
  );

  await ensureDeleted(
    supabase
      .from('learning_space_links')
      .delete()
      .eq('org_id', orgId)
      .eq('learning_space_id', learningSpaceId),
  );

  await ensureDeleted(
    supabase
      .from('learning_spaces')
      .delete()
      .eq('org_id', orgId)
      .eq('id', learningSpaceId),
  );
}

async function ensureDeleted(
  request: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await request;
  if (error) {
    throw new Error(error.message);
  }
}
