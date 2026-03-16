import type { SupabaseClient } from '@supabase/supabase-js';
import type { FamilyLinkInviteVM, FamilyLinkVM, FamilyVM } from '@iconicedu/shared-types';

import {
  getFamiliesByOrg,
  getFamilyInvitesByFamilyIds,
  getFamilyLinksByFamilyIds,
  getFamilyLinksByOrg,
} from '@iconicedu/web/lib/family/queries/families.query';
import { mapFamilyLinkInviteRowToVM } from '@iconicedu/web/lib/family/queries/invite.query';
import {
  mapFamilyLinkRowToVM,
  mapFamilyRowToVM,
} from '@iconicedu/web/lib/family/mappers/family.mapper';

export async function buildFamiliesByOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<FamilyVM[]> {
  const response = await getFamiliesByOrg(supabase, orgId);
  return (response.data ?? []).map(mapFamilyRowToVM);
}

export async function buildFamilyLinksByFamilyIds(
  supabase: SupabaseClient,
  orgId: string,
  familyIds: string[],
): Promise<FamilyLinkVM[]> {
  const response = await getFamilyLinksByFamilyIds(supabase, orgId, familyIds);
  return (response.data ?? []).map(mapFamilyLinkRowToVM);
}

export async function buildFamilyLinksByOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<FamilyLinkVM[]> {
  const response = await getFamilyLinksByOrg(supabase, orgId);
  return (response.data ?? []).map(mapFamilyLinkRowToVM);
}

export async function buildFamilyInvitesByFamilyIds(
  supabase: SupabaseClient,
  orgId: string,
  familyIds: string[],
): Promise<FamilyLinkInviteVM[]> {
  const response = await getFamilyInvitesByFamilyIds(supabase, orgId, familyIds);
  return (response.data ?? []).map(mapFamilyLinkInviteRowToVM);
}
