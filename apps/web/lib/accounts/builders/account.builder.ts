import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserAccountVM } from '@iconicedu/shared-types';

import {
  mapAccountRowToVM,
  mapUserRoles,
} from '@iconicedu/web/lib/accounts/mappers/account.mapper';
import {
  getAccountByAuthUserId,
  getAccountById,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';

export async function buildAccountById(
  supabase: SupabaseClient,
  accountId: string,
  orgId: string,
  authEmail?: string | null,
): Promise<UserAccountVM | null> {
  const [accountResponse, roleResponse] = await Promise.all([
    getAccountById(supabase, accountId),
    getUserRoles(supabase, accountId, orgId),
  ]);

  if (!accountResponse.data) {
    return null;
  }

  const userRoles = mapUserRoles(roleResponse.data ?? []);
  return mapAccountRowToVM(accountResponse.data, {
    accountId,
    orgId,
    authEmail: authEmail ?? null,
    userRoles,
  });
}

export async function buildAccountByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string,
  authEmail?: string | null,
): Promise<UserAccountVM | null> {
  const accountResponse = await getAccountByAuthUserId(supabase, authUserId);

  if (!accountResponse.data) {
    return null;
  }

  const account = accountResponse.data;
  const roleResponse = await getUserRoles(supabase, account.id, account.org_id);
  const userRoles = mapUserRoles(roleResponse.data ?? []);

  return mapAccountRowToVM(account, {
    accountId: account.id,
    orgId: account.org_id,
    authEmail: authEmail ?? null,
    userRoles,
  });
}
