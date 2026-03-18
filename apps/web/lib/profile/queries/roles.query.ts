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

export async function listUserRolesByOrgId(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('user_roles')
    .select('id, org_id, account_id, role_key, assigned_by, assigned_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<
      Array<
        Pick<
          UserRoleRow,
          'id' | 'org_id' | 'account_id' | 'role_key' | 'assigned_by' | 'assigned_at'
        >
      >
    >();
}

export async function listUserRolesByAccountId(
  supabase: SupabaseClient,
  input: { orgId: string; accountId: string },
) {
  return supabase
    .from('user_roles')
    .select(ROLE_SELECT)
    .eq('org_id', input.orgId)
    .eq('account_id', input.accountId)
    .is('deleted_at', null)
    .returns<UserRoleRow[]>();
}

export async function softDeleteUserRole(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    accountId: string;
    roleKey: UserRoleRow['role_key'];
    deletedBy?: string | null;
  },
) {
  const now = new Date().toISOString();
  return supabase
    .from('user_roles')
    .update({
      deleted_at: now,
      deleted_by: input.deletedBy ?? null,
      updated_at: now,
      updated_by: input.deletedBy ?? null,
    })
    .eq('org_id', input.orgId)
    .eq('account_id', input.accountId)
    .eq('role_key', input.roleKey)
    .is('deleted_at', null)
    .select(ROLE_SELECT)
    .maybeSingle<UserRoleRow>();
}
