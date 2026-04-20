import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

@Injectable()
export class ProfilesService {
  async me(accessToken: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);
    if (!user) return null;

    const { data: account, error } = await supabase
      .from('accounts')
      .select(
        '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
      )
      .eq('auth_user_id', user.id)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return account;
  }

  async get(accessToken: string, profileId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async list(accessToken: string, ids: string[]) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async byAccount(accessToken: string, accountId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, kind, status, display_name, first_name, last_name, avatar_url, avatar_seed, ui_theme_key, deleted_at',
      )
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async update(
    accessToken: string,
    profileId: string,
    body: {
      displayName?: string;
      timezone?: string;
      location?: string;
      avatarUrl?: string;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: body.displayName,
        timezone: body.timezone,
        location_label: body.location,
        avatar_url: body.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async activeForAccount(accessToken: string, accountId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id, active_profile_id')
      .eq('id', accountId)
      .is('deleted_at', null)
      .maybeSingle();
    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) return null;

    if (account.active_profile_id) {
      const { data: activeProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', account.active_profile_id)
        .eq('account_id', accountId)
        .eq('org_id', account.org_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (activeProfile) return activeProfile;
    }

    let fallbackQuery = supabase
      .from('profiles')
      .select('*')
      .eq('account_id', accountId)
      .is('deleted_at', null);
    if (account.org_id) {
      fallbackQuery = fallbackQuery.eq('org_id', account.org_id);
    }
    const { data: fallback, error: fallbackError } = await fallbackQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallbackError) throw new InternalServerErrorException(fallbackError.message);

    if (fallback && account.id && account.active_profile_id !== fallback.id) {
      await serviceSupabase
        .from('accounts')
        .update({ active_profile_id: fallback.id })
        .eq('id', account.id)
        .is('deleted_at', null);
    }

    return fallback ?? null;
  }

  async byAccountIds(accessToken: string, orgId: string, accountIds: string[]) {
    if (!accountIds.length) return [];
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, status, ui_theme_key',
      )
      .eq('org_id', orgId)
      .in('account_id', accountIds)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
