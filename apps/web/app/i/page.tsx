import { redirect } from 'next/navigation';

import { getDefaultOrg } from '@iconicedu/web/lib/org/queries/org.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export default async function DefaultOrgEntryPage() {
  const supabase = createSupabaseServiceClient();
  const defaultOrgResponse = await getDefaultOrg(supabase);
  const defaultOrgSlug = defaultOrgResponse.data?.slug?.trim();

  if (defaultOrgSlug) {
    redirect(`/${defaultOrgSlug}/login`);
  }

  redirect('/');
}
