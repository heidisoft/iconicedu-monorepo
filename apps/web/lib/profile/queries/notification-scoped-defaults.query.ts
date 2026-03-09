import type { SupabaseClient } from '@supabase/supabase-js';

import type { NotificationPreferenceScopeRow } from '@iconicedu/shared-types';
import { NOTIFICATION_SCOPED_DEFAULTS_SELECT } from '@iconicedu/web/lib/profile/constants/selects';

export async function getNotificationScopedDefaults(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  return supabase
    .from('notification_preference_scopes')
    .select(NOTIFICATION_SCOPED_DEFAULTS_SELECT)
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<NotificationPreferenceScopeRow[]>();
}
