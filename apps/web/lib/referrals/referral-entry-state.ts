import 'server-only';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

/** Entry UI accepts invitations before authentication; onboarding consumes previously accepted codes. */
export async function getReferralEntryState(): Promise<
  'guest' | 'signed_in' | 'unavailable'
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return 'signed_in';
    if (!data || (error && error.name !== 'AuthSessionMissingError'))
      return 'unavailable';
    return 'guest';
  } catch {
    return 'unavailable';
  }
}
