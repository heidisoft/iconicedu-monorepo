import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRow } from '@iconicedu/shared-types';

import { ORG_SELECT } from '@iconicedu/web/lib/org/constants/selects';

export async function getOrgById(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('orgs')
    .select(ORG_SELECT)
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle<OrgRow>();
}

export async function getOrgBySlug(supabase: SupabaseClient, slug: string) {
  return supabase
    .from('orgs')
    .select(ORG_SELECT)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle<OrgRow>();
}

export async function getDefaultOrg(supabase: SupabaseClient) {
  return supabase
    .from('orgs')
    .select(ORG_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<OrgRow>();
}

export async function getOrgsByIds(supabase: SupabaseClient, orgIds: string[]) {
  if (!orgIds.length) {
    return { data: [] as OrgRow[] };
  }

  return supabase
    .from('orgs')
    .select(ORG_SELECT)
    .in('id', orgIds)
    .is('deleted_at', null)
    .returns<OrgRow[]>();
}
