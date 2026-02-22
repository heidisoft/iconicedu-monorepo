import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfileRow } from '@iconicedu/shared-types';

import { PROFILE_SELECT, PROFILE_SUMMARY_SELECT } from '@iconicedu/web/lib/profile/constants/selects';

type ProfileInsertPayload = {
  orgId: string;
  accountId: string;
  kind: string;
  displayName?: string | null;
  avatarSource: string;
  avatarUrl: string | null;
  avatarSeed: string;
  timezone: string;
  locale: string;
  status: string;
  uiThemeKey: string;
};

export async function getProfileByAccountId(
  supabase: SupabaseClient,
  accountId: string,
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ProfileRow>();
}

export async function getProfileById(
  supabase: SupabaseClient,
  profileId: string,
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle<ProfileRow>();
}

export async function upsertProfileForAccount(
  supabase: SupabaseClient,
  payload: ProfileInsertPayload,
) {
  return supabase
    .from('profiles')
    .upsert(
      {
        org_id: payload.orgId,
        account_id: payload.accountId,
        kind: payload.kind,
        display_name: payload.displayName ?? null,
        first_name: null,
        last_name: null,
        avatar_source: payload.avatarSource,
        avatar_url: payload.avatarUrl,
        avatar_seed: payload.avatarSeed,
        timezone: payload.timezone,
        locale: payload.locale,
        status: payload.status,
        ui_theme_key: payload.uiThemeKey,
      },
      { onConflict: 'org_id,account_id' },
    )
    .select(PROFILE_SELECT)
    .single<ProfileRow>();
}

export async function insertProfileForAccount(
  supabase: SupabaseClient,
  payload: ProfileInsertPayload,
) {
  const upsertResponse = await supabase
    .from('profiles')
    .upsert(
      {
        org_id: payload.orgId,
        account_id: payload.accountId,
        kind: payload.kind,
        display_name: payload.displayName ?? null,
        first_name: null,
        last_name: null,
        avatar_source: payload.avatarSource,
        avatar_url: payload.avatarUrl,
        avatar_seed: payload.avatarSeed,
        timezone: payload.timezone,
        locale: payload.locale,
        status: payload.status,
        ui_theme_key: payload.uiThemeKey,
      },
      { onConflict: 'org_id,account_id' },
    )
    .select(PROFILE_SELECT)
    .single<ProfileRow>();

  // Fallback for environments that don't have the expected unique constraint.
  if (upsertResponse.error?.code !== '42P10') {
    return upsertResponse;
  }

  return supabase
    .from('profiles')
    .insert({
      org_id: payload.orgId,
      account_id: payload.accountId,
      kind: payload.kind,
      display_name: payload.displayName ?? null,
      first_name: null,
      last_name: null,
      avatar_source: payload.avatarSource,
      avatar_url: payload.avatarUrl,
      avatar_seed: payload.avatarSeed,
      timezone: payload.timezone,
      locale: payload.locale,
      status: payload.status,
      ui_theme_key: payload.uiThemeKey,
    })
    .select(PROFILE_SELECT)
    .single<ProfileRow>();
}

export async function updateProfileForAccount(
  supabase: SupabaseClient,
  payload: ProfileInsertPayload & { profileId: string },
) {
  return supabase
    .from('profiles')
    .update({
      org_id: payload.orgId,
      account_id: payload.accountId,
      kind: payload.kind,
      display_name: payload.displayName ?? null,
      first_name: null,
      last_name: null,
      avatar_source: payload.avatarSource,
      avatar_url: payload.avatarUrl,
      avatar_seed: payload.avatarSeed,
      timezone: payload.timezone,
      locale: payload.locale,
      status: payload.status,
      ui_theme_key: payload.uiThemeKey,
    })
    .eq('id', payload.profileId)
    .eq('org_id', payload.orgId)
    .is('deleted_at', null)
    .select(PROFILE_SELECT)
    .maybeSingle<ProfileRow>();
}

export async function updateProfileAvatar(
  supabase: SupabaseClient,
  payload: {
    profileId: string;
    orgId: string;
    avatarUrl: string;
    avatarSource: string;
  },
) {
  return supabase
    .from('profiles')
    .update({
      avatar_source: payload.avatarSource,
      avatar_url: payload.avatarUrl,
    })
    .eq('id', payload.profileId)
    .eq('org_id', payload.orgId)
    .select(PROFILE_SELECT)
    .maybeSingle<ProfileRow>();
}

export async function deleteProfilesByAccountId(
  supabase: SupabaseClient,
  accountId: string,
  orgId: string,
) {
  return supabase
    .from('profiles')
    .delete()
    .eq('account_id', accountId)
    .eq('org_id', orgId);
}

export async function getChildProfilesByAccountIds(
  supabase: SupabaseClient,
  orgId: string,
  accountIds: string[],
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('account_id', accountIds)
    .eq('org_id', orgId)
    .eq('kind', 'child')
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

export async function getProfilesByAccountIds(
  supabase: SupabaseClient,
  orgId: string,
  accountIds: string[],
) {
  if (!accountIds.length) {
    return { data: [] as ProfileRow[] };
  }
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('account_id', accountIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

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

export async function getProfileSummariesByAccountIds(
  supabase: SupabaseClient,
  orgId: string,
  accountIds: string[],
) {
  if (!accountIds.length) {
    return { data: [] as ProfileRow[] };
  }
  return supabase
    .from('profiles')
    .select(PROFILE_SUMMARY_SELECT)
    .in('account_id', accountIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}

export async function getProfilesByKind(
  supabase: SupabaseClient,
  orgId: string,
  kind: string,
) {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('org_id', orgId)
    .eq('kind', kind)
    .is('deleted_at', null)
    .returns<ProfileRow[]>();
}
