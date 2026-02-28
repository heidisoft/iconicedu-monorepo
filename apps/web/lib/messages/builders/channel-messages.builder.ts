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
import { createSignedChannelFileUrl } from '@iconicedu/web/lib/messages/queries/file-url.query';

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
  const [fileResponse, mediaResponse] = await Promise.all([
    getChannelFilesByChannelIds(supabase, orgId, [channelId]),
    getChannelMediaByChannelIds(supabase, orgId, [channelId]),
  ]);

  const files = await Promise.all(
    (fileResponse.data ?? []).map(async (row) => {
      let signedUrl = '';
      try {
        signedUrl = await createSignedChannelFileUrl(supabase, row.url);
      } catch {
        signedUrl = '';
      }
      return mapChannelFileRow(
        {
          ...row,
        },
        { resolvedUrl: signedUrl },
      );
    }),
  );

  const mediaFiles = await Promise.all(
    (mediaResponse.data ?? []).map(async (row) => {
      let signedUrl = '';
      try {
        signedUrl = await createSignedChannelFileUrl(supabase, row.url);
      } catch {
        signedUrl = '';
      }
      return {
        ids: { id: row.id, orgId: row.org_id, channelId: row.channel_id },
        messageId: row.message_id ?? undefined,
        senderId: row.sender_profile_id ?? undefined,
        kind: 'file' as const,
        url: signedUrl,
        storagePath: row.url,
        name: row.name ?? 'Image',
        mimeType: 'image/*',
        createdAt: row.created_at,
      };
    }),
  );

  return [...files, ...mediaFiles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
