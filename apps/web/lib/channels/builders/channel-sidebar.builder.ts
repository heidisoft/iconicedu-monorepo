import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelVM, MessageVM } from '@iconicedu/shared-types';
import { groupBy } from '@iconicedu/utils';

import {
  createDefaultChannelReadState,
  mapChannelCapabilityRow,
  mapChannelReadStateRow,
  mapChannelRowToVM,
} from '@iconicedu/web/lib/channels/mappers/channel.mapper';
import {
  getChannelCapabilitiesByChannelIds,
  getChannelParticipantsByChannelIds,
  getChannelReadStatesByAccountId,
  getChannelsByOrg,
} from '@iconicedu/web/lib/channels/queries/channels.query';
import { getThreadReadStatesByAccountId } from '@iconicedu/web/lib/messages/queries/messages.query';
import { loadParticipantsByChannel } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { buildChannelMessages } from '@iconicedu/web/lib/messages/builders/channel-messages.builder';

type SidebarProjectionOptions = {
  accountId?: string | null;
};

// Bounded projection of every org channel for sidebar/navigation rendering: metadata,
// participants, capabilities, and unread counts, batched across all channels in a
// fixed number of queries regardless of channel count. Sidebar consumers only ever
// read `collections.participants` and `collections.readState` off a channel VM (never
// `messages`/`media`/`files`), so this intentionally skips the per-channel
// thread/message/media/file builders that `channel.builder.ts` runs for detail routes.
export async function buildChannelsSidebarProjection(
  supabase: SupabaseClient,
  orgId: string,
  options: SidebarProjectionOptions = {},
): Promise<ChannelVM[]> {
  const channelsResponse = await getChannelsByOrg(supabase, orgId);
  const rows = channelsResponse.data ?? [];
  if (!rows.length) {
    return [];
  }

  const channelIds = rows.map((row) => row.id);
  const [
    membersResponse,
    capabilitiesResponse,
    channelReadStatesResponse,
    threadReadStatesResponse,
  ] = await Promise.all([
    getChannelParticipantsByChannelIds(supabase, orgId, channelIds),
    getChannelCapabilitiesByChannelIds(supabase, orgId, channelIds),
    options.accountId
      ? getChannelReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
    options.accountId
      ? getThreadReadStatesByAccountId(supabase, orgId, options.accountId)
      : Promise.resolve({ data: [] }),
  ]);

  const membersByChannel = groupBy(membersResponse.data ?? [], (row) => row.channel_id);
  const capabilitiesByChannel = groupBy(
    capabilitiesResponse.data ?? [],
    (row) => row.channel_id,
  );
  const channelReadStateByChannel = new Map(
    (channelReadStatesResponse.data ?? []).map((row) => [row.channel_id, row]),
  );

  // `channel_read_state` rows with a `thread_id` already carry a maintained
  // `unread_count` per thread; summing them per `channel_id` gives the sidebar's
  // per-channel thread-unread badge without fetching a single thread or message row.
  const threadUnreadByChannel = new Map<string, number>();
  (threadReadStatesResponse.data ?? []).forEach((row) => {
    if (!row.channel_id) {
      return;
    }
    const current = threadUnreadByChannel.get(row.channel_id) ?? 0;
    threadUnreadByChannel.set(
      row.channel_id,
      current + Math.max(0, row.unread_count ?? 0),
    );
  });

  const participantsByChannel = await loadParticipantsByChannel(
    supabase,
    orgId,
    membersByChannel,
  );

  return rows.map((row) => {
    const capabilities = (capabilitiesByChannel.get(row.id) ?? []).map(
      mapChannelCapabilityRow,
    );
    const channelReadStateRow = channelReadStateByChannel.get(row.id);
    const threadUnreadCount = threadUnreadByChannel.get(row.id) ?? 0;

    return mapChannelRowToVM(row, {
      participants: participantsByChannel.get(row.id) ?? [],
      messages: [],
      media: [],
      files: [],
      capabilities: capabilities.length ? capabilities : undefined,
      readState: channelReadStateRow
        ? { ...mapChannelReadStateRow(channelReadStateRow), threadUnreadCount }
        : { ...createDefaultChannelReadState(row.id), threadUnreadCount },
    });
  });
}

// Sidebar consumers leave `collections.messages` empty (see above) for good reason on
// the full org channel set, but a handful of UI behaviors genuinely need the latest
// message: `nav-direct-messages.tsx` sorts DMs by recent activity and falls back to
// the latest sender's name, and `sidebar-unread.ts` uses the latest message's sender
// to infer "unread" for a channel that has no persisted read-state row yet (a brand
// new channel). Fetch a single bounded (`LIMIT 1`) latest message per channel — only
// for the caller-supplied, already viewer-scoped channel list (DMs, learning-space
// channels, alerts, class requests), never the full org channel set — so this stays a
// small, fixed-per-viewer cost rather than reintroducing the org-wide fan-out this
// module exists to remove.
export async function getLatestMessagesByChannelId(
  supabase: SupabaseClient,
  orgId: string,
  channels: ChannelVM[],
): Promise<Map<string, MessageVM[]>> {
  const uniqueChannelIds = Array.from(new Set(channels.map((channel) => channel.ids.id)));

  const entries = await Promise.all(
    uniqueChannelIds.map(async (channelId) => {
      const messages = await buildChannelMessages(supabase, orgId, channelId, {
        limit: 1,
      });
      return [channelId, messages] as const;
    }),
  );

  return new Map(entries);
}

export function withLatestMessagePreview(
  channel: ChannelVM,
  latestMessagesByChannelId: Map<string, MessageVM[]>,
): ChannelVM {
  const messages = latestMessagesByChannelId.get(channel.ids.id);
  if (!messages?.length) {
    return channel;
  }

  return {
    ...channel,
    collections: {
      ...channel.collections,
      messages: { items: messages, total: messages.length },
    },
  };
}
