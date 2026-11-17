import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { canAccessProfileAsActor } from '@iconicedu/api/lib/actor/resolve-actor-profile';

/** Internal, invitation-scoped contact permission; public ensure-dm never supplies this context. */
export async function authorizeClassroomCallContact(
  db: SupabaseServiceClient,
  session: ReturnType<typeof createSupabaseSessionClient>,
  input: { orgId: string; otherProfileId: string },
  callId: string,
): Promise<boolean> {
  const call = await db
    .from('classroom_call_invitations')
    .select('caller_profile_id,recipient_profile_id,live_session_id')
    .eq('id', callId)
    .maybeSingle();
  if (call.error)
    throw new InternalServerErrorException('Unable to verify tutor contact');
  if (!call.data || call.data.caller_profile_id !== input.otherProfileId) return false;
  const recipient = await db
    .from('profiles')
    .select('id,org_id,account_id')
    .eq('id', call.data.recipient_profile_id)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .maybeSingle();
  if (recipient.error)
    throw new InternalServerErrorException('Unable to verify tutor contact');
  if (
    !recipient.data ||
    !(await canAccessProfileAsActor({
      sessionSupabase: session,
      serviceSupabase: db,
      orgId: input.orgId,
      profile: recipient.data,
    }))
  )
    return false;
  const meeting = await db
    .from('channel_live_sessions')
    .select('channel_id')
    .eq('id', call.data.live_session_id)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meeting.error)
    throw new InternalServerErrorException('Unable to verify tutor contact');
  if (!meeting.data) return false;
  const members = await db
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', meeting.data.channel_id)
    .in('profile_id', [input.otherProfileId, recipient.data.id])
    .is('deleted_at', null);
  if (members.error)
    throw new InternalServerErrorException('Unable to verify tutor contact');
  const ids = new Set((members.data ?? []).map((row) => row.profile_id));
  return ids.has(input.otherProfileId) && ids.has(recipient.data.id);
}
