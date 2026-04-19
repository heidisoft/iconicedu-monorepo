import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { ensureSystemProfileId } from '@iconicedu/web/lib/automation/system-profile';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type LearningSpaceSummaryRow = {
  id: string;
  title: string;
};

export async function archiveLearningSpace(learningSpaceId: string) {
  const { supabase, orgId, profileId, now } = await requireAdminAuthContext();

  const learningSpaceResponse = await supabase
    .from('learning_spaces')
    .select('id, title')
    .eq('org_id', orgId)
    .eq('id', learningSpaceId)
    .is('deleted_at', null)
    .maybeSingle<LearningSpaceSummaryRow>();

  if (learningSpaceResponse.error) {
    throw new Error(learningSpaceResponse.error.message);
  }
  if (!learningSpaceResponse.data) {
    throw new Error('Class not found');
  }

  const channelResponse = await supabase
    .from('learning_space_channels')
    .select('channel_id')
    .eq('org_id', orgId)
    .eq('learning_space_id', learningSpaceId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ channel_id: string }>();

  if (channelResponse.error) {
    throw new Error(channelResponse.error.message);
  }

  const updateResponse = await supabase
    .from('learning_spaces')
    .update({
      status: 'archived',
      archived_at: now,
      updated_at: now,
      updated_by: profileId,
    })
    .eq('org_id', orgId)
    .eq('id', learningSpaceId)
    .is('deleted_at', null);

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message);
  }

  const serviceSupabase = createSupabaseServiceClient();
  await ensureSystemProfileId(serviceSupabase, orgId);
}
