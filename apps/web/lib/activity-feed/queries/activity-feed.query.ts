import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityFeedItemRow,
  ActivityFeedSectionRow,
  ClassSessionCompletionVoteRow,
  ClassSessionFeedbackRow,
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

export async function getClassSessionFeedbackByProfileAndSessions(
  supabase: SupabaseClient,
  orgId: string,
  recipientProfileId: string,
  classSessionIds: string[],
) {
  return supabase
    .from('class_session_feedback')
    .select(
      'source_event_id, message_id, class_session_id, classroom_id, channel_id, occurrence_start_at, rating, comment, submitted_at',
    )
    .eq('org_id', orgId)
    .eq('recipient_profile_id', recipientProfileId)
    .is('deleted_at', null)
    .in('class_session_id', classSessionIds)
    .returns<
      Pick<
        ClassSessionFeedbackRow,
        | 'source_event_id'
        | 'message_id'
        | 'class_session_id'
        | 'classroom_id'
        | 'channel_id'
        | 'occurrence_start_at'
        | 'rating'
        | 'comment'
        | 'submitted_at'
      >[]
    >();
}

export async function getClassSessionCompletionVotesByProfileAndTargets(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  scheduleIds: string[],
  occurrenceKeys: string[],
) {
  return supabase
    .from('class_session_completion_votes')
    .select(
      'schedule_id, occurrence_key, profile_id, role, status, dispute_category, dispute_reason, reschedule_requested, voted_at',
    )
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .in('schedule_id', scheduleIds)
    .in('occurrence_key', occurrenceKeys)
    .returns<
      Pick<
        ClassSessionCompletionVoteRow,
        | 'schedule_id'
        | 'occurrence_key'
        | 'profile_id'
        | 'role'
        | 'status'
        | 'dispute_category'
        | 'dispute_reason'
        | 'reschedule_requested'
        | 'voted_at'
      >[]
    >();
}
