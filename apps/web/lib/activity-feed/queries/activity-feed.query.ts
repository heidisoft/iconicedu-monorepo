import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityFeedItemRow,
  ActivityFeedSectionRow,
} from '@iconicedu/shared-types';

import {
  ACTIVITY_FEED_ITEM_SELECT,
  ACTIVITY_FEED_SECTION_SELECT,
} from '@iconicedu/web/lib/activity-feed/constants/selects';

export async function getActivityFeedItemsByOrg(
  supabase: SupabaseClient,
  orgId: string,
  recipientProfileId?: string,
) {
  const query = supabase
    .from('activity_feed_items')
    .select(ACTIVITY_FEED_ITEM_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });

  if (recipientProfileId) {
    query.eq('recipient_profile_id', recipientProfileId);
  }

  return query.returns<ActivityFeedItemRow[]>();
}

export async function getActivityFeedItemsByProfileAndTab(
  supabase: SupabaseClient,
  orgId: string,
  recipientProfileId: string,
  tabKey: string,
) {
  return supabase
    .from('activity_feed_items')
    .select(ACTIVITY_FEED_ITEM_SELECT)
    .eq('org_id', orgId)
    .eq('recipient_profile_id', recipientProfileId)
    .eq('tab_key', tabKey)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .returns<ActivityFeedItemRow[]>();
}

export async function getActivityFeedSectionsByOrg(
  supabase: SupabaseClient,
  orgId: string,
) {
  return supabase
    .from('activity_feed_sections')
    .select(ACTIVITY_FEED_SECTION_SELECT)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .returns<ActivityFeedSectionRow[]>();
}
