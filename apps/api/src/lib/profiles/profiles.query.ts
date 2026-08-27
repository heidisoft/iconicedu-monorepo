import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

export const PROFILE_SELECT = [
  'id',
  'org_id',
  'account_id',
  'kind',
  'display_name',
  'first_name',
  'last_name',
  'bio',
  'avatar_source',
  'avatar_url',
  'avatar_seed',
  'avatar_updated_at',
  'timezone',
  'locale',
  'languages_spoken',
  'status',
  'country_code',
  'country_name',
  'region',
  'city',
  'postal_code',
  'ui_theme_key',
  'created_at',
  'updated_at',
].join(',');

export async function getProfilesByIds(
  supabase: SupabaseClient,
  orgId: string,
  profileIds: string[],
) {
  if (!profileIds.length) {
    return { data: [] as ProfileRow[] };
  }

  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('id', profileIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

export async function getAccountByAuthUserIdInOrg(
  supabase: SupabaseClient,
  authUserId: string,
  orgId: string,
) {
  return supabase
    .from('accounts')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle<AccountRow>();
}

export async function getProfilesByAccountId(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('account_id', accountId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

export async function getProfileByIdInOrg(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', profileId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle<ProfileRow>();
}
