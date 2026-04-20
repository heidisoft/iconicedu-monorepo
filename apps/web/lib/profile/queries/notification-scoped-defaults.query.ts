import type { SupabaseClient } from '@supabase/supabase-js';

import type { NotificationPreferenceScopeRow } from '@iconicedu/shared-types';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function getNotificationScopedDefaults(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  const api = createApiClient(supabase);
  const data = await api.get<NotificationPreferenceScopeRow[]>(
    '/notification-preferences/scopes',
    {
      orgId,
      profileId,
    },
  );
  return { data, error: null };
}
