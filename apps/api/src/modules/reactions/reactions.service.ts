import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class ReactionsService {
  async add(
    accessToken: string,
    body: { orgId: string; messageId: string; emoji: string; accountId: string },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
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

    return { success: true };
  }

  async remove(
    accessToken: string,
    body: { orgId: string; messageId: string; emoji: string; accountId: string },
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
