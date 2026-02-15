import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChannelFileItemVM,
  ChannelMediaItemVM,
  MessageVM,
  ThreadVM,
} from '@iconicedu/shared-types';

import {
  getChannelFilesByChannelIds,
  getChannelMediaByChannelIds,
} from '@iconicedu/web/lib/messages/queries/messages.query';
import {
  mapChannelFileRow,
  mapChannelMediaRow,
} from '@iconicedu/web/lib/messages/mappers/message.mapper';
import { buildMessagesByChannelId } from '@iconicedu/web/lib/messages/builders/message.builder';

export async function buildChannelMessages(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
  options: { threadsById?: Map<string, ThreadVM>; limit?: number } = {},
): Promise<MessageVM[]> {
  return buildMessagesByChannelId(supabase, orgId, channelId, {
    threadsById: options.threadsById,
    limit: options.limit,
  });
}

export async function buildChannelMedia(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
): Promise<ChannelMediaItemVM[]> {
  const response = await getChannelMediaByChannelIds(supabase, orgId, [channelId]);
  return (response.data ?? []).map(mapChannelMediaRow);
}

export async function buildChannelFiles(
  supabase: SupabaseClient,
  orgId: string,
  channelId: string,
): Promise<ChannelFileItemVM[]> {
  const response = await getChannelFilesByChannelIds(supabase, orgId, [channelId]);
  return (response.data ?? []).map(mapChannelFileRow);
}
