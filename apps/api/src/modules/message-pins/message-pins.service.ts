import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { PinnedMessageVM, RawSenderProfile } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { buildSenderProfile } from '@iconicedu/utils';

/** A channel may have at most this many active pins at once. */
const MAX_PINS_PER_CHANNEL = 25;

@Injectable()
export class MessagePinsService {
  constructor(private readonly messagesService: MessagesService) {}

  private async requireCanManageChannel(accessToken: string, channelId: string) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await sessionSupabase.rpc('can_manage_channel', {
      _channel_id: channelId,
    });
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) {
      throw new ForbiddenException('You do not have permission to pin messages here');
    }
  }

  async togglePin(
    accessToken: string,
    input: {
      orgId: string;
      channelId: string;
      messageId: string;
      isPinned: boolean;
      profileId: string;
    },
  ) {
    await this.requireCanManageChannel(accessToken, input.channelId);
    const serviceSupabase = createSupabaseServiceClient();
    const now = new Date().toISOString();

    if (!input.isPinned) {
      const { error } = await serviceSupabase
        .from('message_pins')
        .update({ deleted_at: now, deleted_by: input.profileId, updated_at: now })
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('message_id', input.messageId)
        .is('deleted_at', null);
      if (error) throw new InternalServerErrorException(error.message);
      return { success: true };
    }

    const { count, error: countError } = await serviceSupabase
      .from('message_pins')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null);
    if (countError) throw new InternalServerErrorException(countError.message);
    if ((count ?? 0) >= MAX_PINS_PER_CHANNEL) {
      throw new ForbiddenException(
        `This channel already has the maximum of ${MAX_PINS_PER_CHANNEL} pinned messages`,
      );
    }

    const { error } = await serviceSupabase.from('message_pins').upsert(
      {
        org_id: input.orgId,
        channel_id: input.channelId,
        message_id: input.messageId,
        pinned_by: input.profileId,
        created_at: now,
        created_by: input.profileId,
        updated_at: now,
        updated_by: input.profileId,
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: 'org_id,channel_id,message_id' },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async listPinned(
    accessToken: string,
    input: { orgId: string; channelId: string; profileId: string; accountId: string },
  ): Promise<PinnedMessageVM[]> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await sessionSupabase
      .from('message_pins')
      .select('message_id, pinned_by, created_at')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .returns<Array<{ message_id: string; pinned_by: string; created_at: string }>>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data?.length) return [];

    const messages = await this.messagesService.getMessagesByIds({
      accessToken,
      orgId: input.orgId,
      messageIds: data.map((row) => row.message_id),
      profileId: input.profileId,
      accountId: input.accountId,
    });
    const messagesById = new Map(messages.map((message) => [message.ids.id, message]));

    const pinnerIds = Array.from(new Set(data.map((row) => row.pinned_by)));
    const serviceSupabase = createSupabaseServiceClient();
    const { data: pinnerProfiles, error: pinnerError } = await serviceSupabase
      .from('profiles')
      .select(
        'id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, timezone, ui_theme_key',
      )
      .in('id', pinnerIds)
      .is('deleted_at', null)
      .returns<RawSenderProfile[]>();
    if (pinnerError) throw new InternalServerErrorException(pinnerError.message);
    const pinnerById = new Map((pinnerProfiles ?? []).map((row) => [row.id, row]));

    return data
      .map((row) => {
        const message = messagesById.get(row.message_id);
        const pinnerRow = pinnerById.get(row.pinned_by);
        if (!message || !pinnerRow) return null;
        return {
          message,
          pinnedBy: buildSenderProfile(pinnerRow, input.orgId),
          pinnedAt: row.created_at,
        } satisfies PinnedMessageVM;
      })
      .filter((row): row is PinnedMessageVM => Boolean(row));
  }
}
