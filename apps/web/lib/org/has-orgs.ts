import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasAnyActiveOrgs(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('orgs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}
