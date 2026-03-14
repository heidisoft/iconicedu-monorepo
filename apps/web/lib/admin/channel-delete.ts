import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

function canManageChannels(roleKey: string | null | undefined) {
  return (
    roleKey === 'owner' ||
    roleKey === 'admin' ||
    roleKey === 'staff' ||
    roleKey === 'educator'
  );
}

export async function deleteChannel(channelId: string) {
  const { supabase, accountId, orgId, profileId, now } = await requireAdminAuthContext();

  const rolesResponse = await getUserRoles(supabase, accountId, orgId);
  if (rolesResponse.error) {
    throw new Error(rolesResponse.error.message);
  }

  const hasManagerRole = (rolesResponse.data ?? []).some((role) =>
    canManageChannels(role.role_key),
  );
  if (!hasManagerRole) {
    throw new Error('Forbidden');
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { error } = await serviceSupabase
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
