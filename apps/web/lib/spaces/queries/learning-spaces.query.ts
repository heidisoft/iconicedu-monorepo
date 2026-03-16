import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningSpaceRow } from '@iconicedu/shared-types';

import { LEARNING_SPACE_SELECT } from '@iconicedu/web/lib/spaces/constants/selects';

export async function getLearningSpacesByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('learning_spaces')
    .select(LEARNING_SPACE_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<LearningSpaceRow[]>();
}

export async function getLearningSpacesByIds(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return { data: [] as LearningSpaceRow[] };
  }

  return supabase
    .from('learning_spaces')
    .select(LEARNING_SPACE_SELECT)
    .eq('org_id', orgId)
    .in('id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<LearningSpaceRow[]>();
}

export async function getLearningSpaceById(
  supabase: SupabaseClient,
  learningSpaceId: string,
) {
  return supabase
    .from('learning_spaces')
    .select(LEARNING_SPACE_SELECT)
    .eq('id', learningSpaceId)
    .is('deleted_at', null)
    .maybeSingle<LearningSpaceRow>();
}
