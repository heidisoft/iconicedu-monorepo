import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { publishReactionAddedActivity } from '@iconicedu/api/lib/messages/message-activity';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class ReactionsService {
  async add(
    accessToken: string,
    body: {
      orgId: string;
      messageId: string;
      emoji: string;
      accountId: string;
      profileId: string;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();
    const profileResponse = await serviceSupabase
      .from('profiles')
      .select('id, org_id, account_id')
      .eq('id', body.profileId)
      .eq('org_id', body.orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; org_id: string; account_id: string }>();
    if (profileResponse.error)
      throw new InternalServerErrorException(profileResponse.error.message);
    if (!profileResponse.data) throw new NotFoundException('Profile not found');
    if (profileResponse.data.account_id !== body.accountId) {
      const familyLinkResponse = await serviceSupabase
        .from('family_links')
        .select('id')
        .eq('org_id', body.orgId)
        .eq('guardian_account_id', body.accountId)
        .eq('child_account_id', profileResponse.data.account_id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();
      if (familyLinkResponse.error) {
        throw new InternalServerErrorException(familyLinkResponse.error.message);
      }
      if (!familyLinkResponse.data) {
        throw new ForbiddenException('Profile is not available to this account');
      }
    }

    const messageResponse = await serviceSupabase
      .from('messages')
      .select('id, channel_id, sender_profile_id')
      .eq('org_id', body.orgId)
      .eq('id', body.messageId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        channel_id: string | null;
        sender_profile_id: string | null;
      }>();
    if (messageResponse.error)
      throw new InternalServerErrorException(messageResponse.error.message);
    if (!messageResponse.data) throw new NotFoundException('Message not found');
    if (!messageResponse.data.channel_id) {
      throw new NotFoundException('Message channel not found');
    }

    const { data: existing, error: selectError } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('org_id', body.orgId)
      .eq('message_id', body.messageId)
      .eq('account_id', body.accountId)
      .eq('emoji', body.emoji)
      .is('deleted_at', null)
      .maybeSingle();
    if (selectError) throw new InternalServerErrorException(selectError.message);
    if (existing) return { success: true, alreadyExisted: true };

    const { data: countRow, error: countSelectError } = await supabase
      .from('message_reaction_counts')
      .select('id, count')
      .eq('org_id', body.orgId)
      .eq('message_id', body.messageId)
      .eq('emoji', body.emoji)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; count: number }>();
    if (countSelectError)
      throw new InternalServerErrorException(countSelectError.message);

    const { error } = await supabase.from('message_reactions').insert({
      org_id: body.orgId,
      message_id: body.messageId,
      account_id: body.accountId,
      emoji: body.emoji,
    });
    if (error) throw new InternalServerErrorException(error.message);

    if (countRow) {
      const { error: updateCountError } = await supabase
        .from('message_reaction_counts')
        .update({ count: countRow.count + 1 })
        .eq('id', countRow.id);
      if (updateCountError)
        throw new InternalServerErrorException(updateCountError.message);
    } else {
      const { error: insertCountError } = await supabase
        .from('message_reaction_counts')
        .insert({
          org_id: body.orgId,
          message_id: body.messageId,
          emoji: body.emoji,
          count: 1,
        });
      if (insertCountError)
        throw new InternalServerErrorException(insertCountError.message);
    }

    await publishReactionAddedActivity({
      supabase: serviceSupabase,
      orgId: body.orgId,
      channelId: messageResponse.data.channel_id,
      senderProfileId: body.profileId,
      messageId: body.messageId,
      messageSenderProfileId: messageResponse.data.sender_profile_id ?? '',
      emoji: body.emoji,
      now: new Date().toISOString(),
    });

    return { success: true };
  }

  async remove(
    accessToken: string,
    body: {
      orgId: string;
      messageId: string;
      emoji: string;
      accountId: string;
      profileId: string;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data: countRow, error: countSelectError } = await supabase
      .from('message_reaction_counts')
      .select('id, count')
      .eq('org_id', body.orgId)
      .eq('message_id', body.messageId)
      .eq('emoji', body.emoji)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; count: number }>();
    if (countSelectError)
      throw new InternalServerErrorException(countSelectError.message);

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('org_id', body.orgId)
      .eq('message_id', body.messageId)
      .eq('account_id', body.accountId)
      .eq('emoji', body.emoji);
    if (error) throw new InternalServerErrorException(error.message);

    if (countRow) {
      if (countRow.count <= 1) {
        const { error: deleteCountError } = await supabase
          .from('message_reaction_counts')
          .delete()
          .eq('id', countRow.id);
        if (deleteCountError) {
          throw new InternalServerErrorException(deleteCountError.message);
        }
      } else {
        const { error: updateCountError } = await supabase
          .from('message_reaction_counts')
          .update({ count: countRow.count - 1 })
          .eq('id', countRow.id);
        if (updateCountError) {
          throw new InternalServerErrorException(updateCountError.message);
        }
      }
    }

    return { success: true };
  }
}
