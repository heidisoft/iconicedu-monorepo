import type { SupabaseClient } from '@supabase/supabase-js';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';

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
    throw new Error('Class not found');
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

  const api = createApiClient(supabase);
  await api.post('/schedules/learning-space/delete', {
    orgId,
    learningSpaceId,
  });

  await deleteChannels(supabase, orgId, learningSpaceId, channelIds);
  await deleteLearningSpaceRelations(supabase, orgId, learningSpaceId);
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
