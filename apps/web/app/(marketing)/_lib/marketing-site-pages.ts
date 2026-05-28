import { notFound } from 'next/navigation';
import { enableMarketingSitePages } from '@iconicedu/web/flags';
import { resolveDefaultOrgGetStartedPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function assertMarketingSitePagesEnabled() {
  const isEnabled = await enableMarketingSitePages.run({
    identify: { profileId: null },
  });
  if (!isEnabled) {
    notFound();
  }
}

export async function resolveMarketingLoginHref() {
  const supabase = await createSupabaseServerClient();
  return resolveDefaultOrgGetStartedPath(supabase);
}
