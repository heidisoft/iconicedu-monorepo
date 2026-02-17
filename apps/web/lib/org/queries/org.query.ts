import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRow } from '@iconicedu/shared-types';

import { ORG_SELECT } from '../constants/selects';

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
