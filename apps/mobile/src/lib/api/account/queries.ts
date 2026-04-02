import { supabase } from '@/lib/supabase/client';

export async function activateAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from('accounts')
    .update({ status: 'active' })
    .eq('auth_user_id', session.user.id);

  if (error) return;
}

export async function fetchUserAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: account, error } = await supabase
    .from('accounts')
    .select(
      '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
    )
    .eq('auth_user_id', user.id)
    .single();

  if (error) throw error;
  return account;
}

export async function fetchProfile(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchProfileByAccountId(accountId: string) {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, active_profile_id')
    .eq('id', accountId)
    .is('deleted_at', null)
    .maybeSingle();

  if (accountError) throw accountError;

  if (account?.active_profile_id) {
    const { data: activeProfile, error: activeProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', account.active_profile_id)
      .eq('account_id', accountId)
      .eq('org_id', account.org_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (activeProfileError) throw activeProfileError;
    if (activeProfile) return activeProfile;
  }

  let fallbackQuery = supabase
    .from('profiles')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null);

  if (account?.org_id) {
    fallbackQuery = fallbackQuery.eq('org_id', account.org_id);
  }

  const { data: fallbackProfile, error: fallbackError } = await fallbackQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw fallbackError;

  if (
    fallbackProfile &&
    account?.id &&
    account.active_profile_id !== fallbackProfile.id
  ) {
    const { error: healError } = await supabase
      .from('accounts')
      .update({ active_profile_id: fallbackProfile.id })
      .eq('id', account.id)
      .is('deleted_at', null);

    if (healError) return fallbackProfile;
  }

  return fallbackProfile ?? null;
}

export async function fetchProfilesForAccount(accountId: string, orgId?: string) {
  let query = supabase
    .from('profiles')
    .select(
      'id, org_id, account_id, kind, status, display_name, first_name, last_name, avatar_url, avatar_seed, ui_theme_key, deleted_at',
    )
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchAccountsByIds(accountIds: string[]) {
  if (!accountIds.length) return [];

  const { data, error } = await supabase
    .from('accounts')
    .select(
      '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
    )
    .in('id', accountIds)
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
}
