import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

export const ARCHIVED_CHANNEL_MESSAGE = 'This conversation is archived and read-only';

/**
 * Archived channels (an archived class, or a tutor DM closed with its class)
 * are read-only. Message inserts are enforced by RLS
 * (public.can_post_to_channel_as_profile); service-role writes such as
 * reactions and edits call this instead.
 */
export async function assertChannelWritable(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('channels')
    .select('status, deleted_at')
    .eq('id', channelId)
    .eq('org_id', orgId)
    .maybeSingle<{ status: string; deleted_at: string | null }>();
  if (error) throw new InternalServerErrorException(error.message);
  if (!data || data.deleted_at || data.status !== 'active') {
    throw new ForbiddenException(ARCHIVED_CHANNEL_MESSAGE);
  }
}
