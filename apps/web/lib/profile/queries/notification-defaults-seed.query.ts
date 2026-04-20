import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function seedSignupDefaultNotificationPreferences(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  const api = createApiClient(supabase);
  await api.post('/notification-preferences/seed-defaults', { orgId, profileId });
  return { error: null };
}
