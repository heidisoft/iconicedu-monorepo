import { resolveDefaultOrgGetStartedPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function resolveMarketingLoginHref() {
  const supabase = await createSupabaseServerClient();
  return resolveDefaultOrgGetStartedPath(supabase);
}
