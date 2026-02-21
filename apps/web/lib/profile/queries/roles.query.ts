import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRoleRow } from '@iconicedu/shared-types';

import { ROLE_SELECT } from '@iconicedu/web/lib/profile/constants/selects';

export async function getUserRoles(
  supabase: SupabaseClient,
  accountId: string,
  orgId: string,
) {
  return supabase
    .from('user_roles')
    .select(ROLE_SELECT)
    .eq('account_id', accountId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<UserRoleRow[]>();
}

export async function upsertUserRole(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    accountId: string;
    roleKey: UserRoleRow['role_key'];
    assignedBy?: string | null;
  },
) {
  return supabase
    .from('user_roles')
    .upsert(
      {
        org_id: input.orgId,
        account_id: input.accountId,
        role_key: input.roleKey,
        assigned_by: input.assignedBy ?? null,
        assigned_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: 'org_id,account_id,role_key' },
    )
    .select(ROLE_SELECT)
    .single<UserRoleRow>();
}
