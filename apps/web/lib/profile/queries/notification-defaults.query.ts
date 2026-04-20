import type { SupabaseClient } from '@supabase/supabase-js';

import type { NotificationPreferenceRow } from '@iconicedu/shared-types';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function getNotificationDefaults(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  const api = createApiClient(supabase);
  const data = await api.get<NotificationPreferenceRow[]>('/notification-preferences', {
    orgId,
    profileId,
  });
  return { data, error: null };
}
