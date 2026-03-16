import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FamilyLinkInviteRow,
  FamilyLinkRow,
  FamilyRow,
} from '@iconicedu/shared-types';

import {
  FAMILY_INVITE_SELECT,
  FAMILY_LINK_SELECT,
  FAMILY_SELECT,
} from '@iconicedu/web/lib/family/constants/selects';

export async function getFamiliesByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('families')
    .select(FAMILY_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<FamilyRow[]>();
}

export async function getFamilyById(
  supabase: SupabaseClient,
  orgId: string,
  familyId: string,
) {
  return supabase
    .from('families')
    .select(FAMILY_SELECT)
    .eq('org_id', orgId)
    .eq('id', familyId)
    .is('deleted_at', null)
    .maybeSingle<FamilyRow>();
}

export async function getFamilyLinksByFamilyIds(
  supabase: SupabaseClient,
  orgId: string,
  familyIds: string[],
) {
  if (!familyIds.length) {
    return { data: [] as FamilyLinkRow[] };
  }
  return supabase
    .from('family_links')
    .select(FAMILY_LINK_SELECT)
    .in('family_id', familyIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<FamilyLinkRow[]>();
}

export async function getFamilyLinksByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('family_links')
    .select(FAMILY_LINK_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<FamilyLinkRow[]>();
}

export async function deleteFamilyLinksByGuardianAccountId(
  supabase: SupabaseClient,
  orgId: string,
  guardianAccountId: string,
) {
  return supabase
    .from('family_links')
    .delete()
    .eq('guardian_account_id', guardianAccountId)
    .eq('org_id', orgId);
}

export async function getFamilyInvitesByFamilyIds(
  supabase: SupabaseClient,
  orgId: string,
  familyIds: string[],
) {
  if (!familyIds.length) {
    return { data: [] as FamilyLinkInviteRow[] };
  }
  return supabase
    .from('family_link_invites')
    .select(FAMILY_INVITE_SELECT)
    .in('family_id', familyIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<FamilyLinkInviteRow[]>();
}
