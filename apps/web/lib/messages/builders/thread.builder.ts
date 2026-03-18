import type { SupabaseClient } from '@supabase/supabase-js';
import type { ThreadVM, UserProfileVM } from '@iconicedu/shared-types';
import { groupBy } from '@iconicedu/utils';

import {
  getThreadById,
  getThreadsByChannelId,
  getThreadParticipantsByThreadIds,
  getThreadReadStatesByAccountId,
} from '@iconicedu/web/lib/messages/queries/messages.query';
import { buildUserProfilesByIds } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapThreadRowToVM } from '@iconicedu/web/lib/messages/mappers/thread.mapper';

type ThreadBuildOptions = {
  accountId?: string;
};

function isThreadUnreadDebugEnabled() {
  return process.env.DEBUG_THREAD_UNREAD?.trim() === 'true';
}

export async function buildThreadsByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: ThreadBuildOptions = {},
): Promise<ThreadVM[]> {
  const threadsResponse = await getThreadsByChannelId(supabase, orgId, channelId);
  const threadRows = threadsResponse.data ?? [];
  if (!threadRows.length) {
    return [];
  }

  const threadIds = threadRows.map((row) => row.id);
  const [participantsResponse, readStateResponse] = await Promise.all([
    getThreadParticipantsByThreadIds(supabase, orgId, threadIds),
    options.accountId
      ? getThreadReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
  ]);

  const participantsByThread = groupBy(
    participantsResponse.data ?? [],
    (row) => row.thread_id,
  );
  const readStateByThread = new Map(
    (readStateResponse.data ?? []).map((row) => [row.thread_id, row]),
  );

  const profileIds = new Set<string>();
  (participantsResponse.data ?? []).forEach((row) => profileIds.add(row.profile_id));

  const profilesById = await resolveProfilesById(supabase, orgId, Array.from(profileIds));

  return threadRows.map((row) => {
    const readState = readStateByThread.get(row.id);
    if (isThreadUnreadDebugEnabled()) {
      console.info('[thread-unread][builder][channel-thread]', {
        threadId: row.id,
        channelId: row.channel_id,
        accountId: options.accountId ?? null,
        unreadCount: readState?.unread_count ?? null,
        lastReadAt: readState?.last_read_at ?? null,
        lastReadMessageId: readState?.last_read_message_id ?? null,
      });
    }
    const participants = (participantsByThread.get(row.id) ?? [])
      .map((participant) => profilesById.get(participant.profile_id))
      .filter((profile): profile is UserProfileVM => Boolean(profile));
    return mapThreadRowToVM(row, {
      participants,
      readState,
    });
  });
}

export async function buildThreadById(
  supabase: SupabaseClient,
  orgId: string,
  threadId: string,
  options: ThreadBuildOptions = {},
): Promise<ThreadVM | null> {
  const threadResponse = await getThreadById(supabase, orgId, threadId);
  const threadRow = threadResponse.data ?? null;
  if (!threadRow) {
    return null;
  }

  const [participantsResponse, readStateResponse] = await Promise.all([
    getThreadParticipantsByThreadIds(supabase, orgId, [threadId]),
    options.accountId
      ? getThreadReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
  ]);

  const participants = (participantsResponse.data ?? [])
    .map((row) => row.profile_id)
    .filter(Boolean);
  const profilesById = await resolveProfilesById(supabase, orgId, participants);
  const participantVMs = (participantsResponse.data ?? [])
    .map((row) => profilesById.get(row.profile_id))
    .filter((profile): profile is UserProfileVM => Boolean(profile));

  const readStateRow =
    (readStateResponse.data ?? []).find((row) => row.thread_id === threadId) ?? null;

  if (isThreadUnreadDebugEnabled()) {
    console.info('[thread-unread][builder][thread-by-id]', {
      threadId,
      channelId: threadRow.channel_id,
      accountId: options.accountId ?? null,
      unreadCount: readStateRow?.unread_count ?? null,
      lastReadAt: readStateRow?.last_read_at ?? null,
      lastReadMessageId: readStateRow?.last_read_message_id ?? null,
    });
  }

  return mapThreadRowToVM(threadRow, {
    participants: participantVMs,
    readState: readStateRow,
  });
}

async function resolveProfilesById(
  supabase: SupabaseClient,
  orgId: string,
  profileIds: string[],
): Promise<Map<string, UserProfileVM>> {
  return buildUserProfilesByIds(supabase, orgId, profileIds);
}
