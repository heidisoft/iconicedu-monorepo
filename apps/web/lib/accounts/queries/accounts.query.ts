import type { SupabaseClient } from '@supabase/supabase-js';

import type { AccountRow, AccountStatus } from '@iconicedu/shared-types';

import { ACCOUNT_SELECT } from '@iconicedu/web/lib/accounts/constants/selects';

type AccountInsertPayload = {
  orgId: string;
  authUserId: string;
  email: string | null;
};

export async function getAccountsByOrgId(
  supabase: SupabaseClient,
  orgId: string,
  options?: { status?: AccountStatus },
) {
  const query = supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (options?.status) {
    query.eq('status', options.status);
  }

  return query.returns<AccountRow[]>();
}

export async function getAccountByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string,
) {
  return supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle<AccountRow>();
}

export async function insertAccountForAuthUser(
  supabase: SupabaseClient,
  payload: AccountInsertPayload,
) {
  return supabase
    .from('accounts')
    .insert({
      org_id: payload.orgId,
      auth_user_id: payload.authUserId,
      email: payload.email,
      preferred_contact_channels: ['email'],
      status: 'active',
    })
    .select(ACCOUNT_SELECT)
    .single<AccountRow>();
}

export async function getAccountById(supabase: SupabaseClient, accountId: string) {
  return supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('id', accountId)
    .is('deleted_at', null)
    .maybeSingle<AccountRow>();
}

export async function getAccountsByIds(
  supabase: SupabaseClient,
  orgId: string,
  accountIds: string[],
) {
  if (!accountIds.length) {
    return { data: [] as AccountRow[] };
  }
  return supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('org_id', orgId)
    .in('id', accountIds)
    .is('deleted_at', null)
    .returns<AccountRow[]>();
}

export async function getAccountByEmail(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
) {
  return supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('org_id', orgId)
    .ilike('email', email)
    .is('deleted_at', null)
    .maybeSingle<AccountRow>();
}

export async function insertInvitedAccount(
  supabase: SupabaseClient,
  payload: { orgId: string; email: string; createdBy: string },
) {
  return supabase
    .from('accounts')
    .insert({
      org_id: payload.orgId,
      email: payload.email,
      preferred_contact_channels: ['email'],
      status: 'invited',
      created_by: payload.createdBy,
      updated_by: payload.createdBy,
    })
    .select(ACCOUNT_SELECT)
    .single<AccountRow>();
}

export async function updateAccountAuthUserId(
  supabase: SupabaseClient,
  accountId: string,
  authUserId: string,
) {
  return supabase
    .from('accounts')
    .update({
      auth_user_id: authUserId,
      status: 'active',
      updated_by: authUserId,
    })
    .eq('id', accountId)
    .select(ACCOUNT_SELECT)
    .single<AccountRow>();
}

export async function updateAccountStatus(
  supabase: SupabaseClient,
  accountId: string,
  orgId: string,
  status: AccountStatus,
  updatedBy?: string | null,
) {
  return supabase
    .from('accounts')
    .update({
      status,
      updated_by: updatedBy ?? null,
    })
    .eq('id', accountId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .select(ACCOUNT_SELECT)
    .maybeSingle<AccountRow>();
}

export async function updateAccountRoleState(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    orgId: string;
    primaryRole: AccountRow['primary_role'] | null;
    roleStatus: NonNullable<AccountRow['role_status']>;
    onboardingCompletedAt?: string | null;
    updatedBy?: string | null;
  },
) {
  return supabase
    .from('accounts')
    .update({
      primary_role: input.primaryRole,
      role_status: input.roleStatus,
      onboarding_completed_at: input.onboardingCompletedAt ?? null,
      updated_by: input.updatedBy ?? null,
    })
    .eq('id', input.accountId)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .select(ACCOUNT_SELECT)
    .maybeSingle<AccountRow>();
}

export async function deleteAccountById(
  supabase: SupabaseClient,
  accountId: string,
  orgId: string,
) {
  return supabase.from('accounts').delete().eq('id', accountId).eq('org_id', orgId);
}
