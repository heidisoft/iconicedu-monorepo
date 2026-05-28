import type { SupabaseClient } from '@supabase/supabase-js';

import { getDefaultOrg } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

export async function resolveDefaultOrgLoginPath(
  supabase: SupabaseClient,
  fallbackPath = '/i/login',
): Promise<string> {
  const defaultOrgResponse = await getDefaultOrg(supabase);
  if (defaultOrgResponse.data?.slug) {
    return `/${defaultOrgResponse.data.slug}/login`;
  }
  return fallbackPath;
}

export async function resolveDefaultOrgGetStartedPath(
  supabase: SupabaseClient,
  fallbackPath = '/get-started',
): Promise<string> {
  const defaultOrgResponse = await getDefaultOrg(supabase);
  if (defaultOrgResponse.data?.slug) {
    return `/${defaultOrgResponse.data.slug}/get-started`;
  }
  return fallbackPath;
}

export async function resolveOrgLoginPath(
  supabase: SupabaseClient,
  orgId: string,
  fallbackPath = '/get-started',
): Promise<string> {
  const dashboardPath = await resolveOrgDashboardPath(supabase, orgId, fallbackPath);
  if (!dashboardPath.startsWith('/')) {
    return fallbackPath;
  }
  if (dashboardPath === fallbackPath) {
    return fallbackPath;
  }
  return `${dashboardPath}/login`;
}
