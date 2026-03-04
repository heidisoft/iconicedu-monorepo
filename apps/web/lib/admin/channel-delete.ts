import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';

export async function deleteChannel(channelId: string) {
  const { supabase, orgId, profileId, now } = await requireAdminAuthContext();

  const { error } = await supabase
    .from('channels')
    .update({
      deleted_at: now,
      deleted_by: profileId,
      updated_at: now,
      updated_by: profileId,
    })
    .eq('org_id', orgId)
    .eq('id', channelId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }
}
