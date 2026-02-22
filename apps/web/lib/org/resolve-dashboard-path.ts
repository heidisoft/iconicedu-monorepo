import type { SupabaseClient } from '@supabase/supabase-js';

import { buildOrgById } from '@iconicedu/web/lib/org/builders/org.builder';

export async function resolveOrgDashboardPath(
  supabase: SupabaseClient,
  orgId: string,
  fallbackPath = '/d',
): Promise<string> {
  const org = await buildOrgById(supabase, orgId);
  if (!org?.slug) {
    return fallbackPath;
  }
  return `/${org.slug}`;
}
