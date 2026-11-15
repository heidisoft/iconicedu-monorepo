import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { MessageSearchResultVM } from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';

const MAX_CANDIDATES = 200;

function buildMatchRanges(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const terms = Array.from(
    new Set(
      query
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  );
  if (!terms.length) return [];

  const lowerText = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    let fromIndex = 0;
    for (;;) {
      const index = lowerText.indexOf(lowerTerm, fromIndex);
      if (index === -1) break;
      ranges.push({ start: index, end: index + term.length });
      fromIndex = index + term.length;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

@Injectable()
export class MessageSearchService {
  constructor(private readonly messagesService: MessagesService) {}

  async searchChannelMessages(
    accessToken: string,
    input: {
      orgId: string;
      channelId: string;
      query: string;
      profileId: string;
      accountId: string;
      senderProfileId?: string;
      createdAfter?: string;
      createdBefore?: string;
      limit?: number;
    },
  ): Promise<MessageSearchResultVM[]> {
    const query = input.query.trim();
    if (!query) throw new BadRequestException('query is required');

    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const textMatchResponse = await sessionSupabase
      .from('message_text')
      .select('message_id, payload')
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
      .limit(MAX_CANDIDATES)
      .returns<Array<{ message_id: string; payload: Record<string, unknown> | null }>>();
    if (textMatchResponse.error) {
      throw new InternalServerErrorException(textMatchResponse.error.message);
    }
    const candidates = textMatchResponse.data ?? [];
    if (!candidates.length) return [];

    let metaQuery = sessionSupabase
      .from('messages')
      .select('id, created_at')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .in(
        'id',
        candidates.map((row) => row.message_id),
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 30);
    if (input.senderProfileId) {
      metaQuery = metaQuery.eq('sender_profile_id', input.senderProfileId);
    }
    if (input.createdAfter) {
      metaQuery = metaQuery.gte('created_at', input.createdAfter);
    }
    if (input.createdBefore) {
      metaQuery = metaQuery.lte('created_at', input.createdBefore);
    }

    const metaResponse =
      await metaQuery.returns<Array<{ id: string; created_at: string }>>();
    if (metaResponse.error)
      throw new InternalServerErrorException(metaResponse.error.message);
    const orderedIds = (metaResponse.data ?? []).map((row) => row.id);
    if (!orderedIds.length) return [];

    const payloadByMessageId = new Map(
      candidates.map((row) => [row.message_id, row.payload]),
    );
    const messages = await this.messagesService.getMessagesByIds({
      accessToken,
      orgId: input.orgId,
      messageIds: orderedIds,
      profileId: input.profileId,
      accountId: input.accountId,
    });

    return messages.map((message) => {
      const payload = payloadByMessageId.get(message.ids.id);
      const text = typeof payload?.text === 'string' ? payload.text : '';
      return {
        message,
        matchRanges: buildMatchRanges(text, query),
      } satisfies MessageSearchResultVM;
    });
  }
}
