import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LearningSpaceChannelRow,
  LearningSpaceParticipantRow,
  LearningSpaceLinkRow,
} from '@iconicedu/shared-types';

import {
  LEARNING_SPACE_CHANNEL_SELECT,
  LEARNING_SPACE_PARTICIPANT_SELECT,
  LEARNING_SPACE_LINK_SELECT,
} from '@iconicedu/web/lib/spaces/constants/selects';

export async function getLearningSpaceChannelsByLearningSpaceIds(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return { data: [] as LearningSpaceChannelRow[] };
  }

  return supabase
    .from('learning_space_channels')
    .select(LEARNING_SPACE_CHANNEL_SELECT)
    .eq('org_id', orgId)
    .in('learning_space_id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<LearningSpaceChannelRow[]>();
}

export async function getLearningSpaceChannelByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from('learning_space_channels')
    .select(LEARNING_SPACE_CHANNEL_SELECT)
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .maybeSingle<LearningSpaceChannelRow>();
}

export async function getLearningSpaceParticipantsByLearningSpaceIds(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return { data: [] as LearningSpaceParticipantRow[] };
  }

  return supabase
    .from('learning_space_participants')
    .select(LEARNING_SPACE_PARTICIPANT_SELECT)
    .eq('org_id', orgId)
    .in('learning_space_id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<LearningSpaceParticipantRow[]>();
}

export async function getLearningSpaceLinksByLearningSpaceIds(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return { data: [] as LearningSpaceLinkRow[] };
  }

  return supabase
    .from('learning_space_links')
    .select(LEARNING_SPACE_LINK_SELECT)
    .eq('org_id', orgId)
    .in('learning_space_id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<LearningSpaceLinkRow[]>();
}
