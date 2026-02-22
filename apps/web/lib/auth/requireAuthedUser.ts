import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';

export async function requireAuthedUser(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const serviceSupabase = createSupabaseServiceClient();
    redirect(await resolveDefaultOrgLoginPath(serviceSupabase));
  }
  return data.user;
}
