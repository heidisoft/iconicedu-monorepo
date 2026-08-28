import type { SupabaseClient } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient, 'auth'>;

export async function signOutCurrentSession(client: AuthClient): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
