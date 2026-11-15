import { createHash, randomBytes } from 'node:crypto';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
export const hashMeetingLink = (value: string) =>
  createHash('sha256').update(value).digest('hex');
type MeetingLink = {
  live_session_id: string;
  purpose: 'invite' | 'handoff' | 'access';
  auth_user_id: string | null;
  passcode_hash: string | null;
  expires_at: string;
};
export async function issueMeetingLink(
  sessionId: string,
  purpose: MeetingLink['purpose'],
  authUserId: string | null,
  passcode: string | null = null,
) {
  const token = randomBytes(24).toString('base64url');
  const ttl = purpose === 'handoff' ? 60 : purpose === 'access' ? 4 * 3600 : 7 * 86400;
  const result = await createSupabaseServiceClient()
    .from('live_session_browser_links')
    .insert({
      token_hash: hashMeetingLink(token),
      live_session_id: sessionId,
      purpose,
      auth_user_id: authUserId,
      passcode_hash: purpose === 'invite' ? hashMeetingLink(passcode ?? '') : null,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  if (result.error)
    throw new InternalServerErrorException('Unable to prepare meeting link');
  return token;
}
export async function resolveMeetingLink(
  token: string,
  sessionId: string,
  passcode: string | null,
) {
  if (!/^[\w-]{32}$/.test(token))
    throw new ForbiddenException('Invalid or expired meeting link');
  const result = await createSupabaseServiceClient()
    .from('live_session_browser_links')
    .select('live_session_id, purpose, auth_user_id, passcode_hash, expires_at')
    .eq('token_hash', hashMeetingLink(token))
    .eq('live_session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<MeetingLink>();
  if (result.error)
    throw new InternalServerErrorException('Unable to verify meeting link');
  const link = result.data;
  if (
    !link ||
    link.purpose === 'handoff' ||
    (link.purpose === 'invite' && link.passcode_hash !== hashMeetingLink(passcode ?? ''))
  )
    throw new ForbiddenException('Invalid or expired meeting link');
  return link;
}
/** Retry-bound redemption: the same browser secret receives the same access token. */
export async function redeemMeetingHandoff(
  token: string,
  sessionId: string,
  redemptionKey: string,
) {
  if (!/^[\w-]{32}$/.test(token) || !/^[\w-]{32}$/.test(redemptionKey))
    throw new ForbiddenException('Invalid or expired meeting link');
  const accessToken = createHash('sha256')
    .update(`meeting-access:${token}:${redemptionKey}`)
    .digest('base64url')
    .slice(0, 32);
  const result = await createSupabaseServiceClient().rpc(
    'redeem_meeting_browser_handoff',
    {
      p_token_hash: hashMeetingLink(token),
      p_session_id: sessionId,
      p_redemption_hash: hashMeetingLink(redemptionKey),
      p_access_hash: hashMeetingLink(accessToken),
    },
  );
  if (result.error) throw new InternalServerErrorException('Unable to open meeting');
  if (!result.data) throw new ForbiddenException('Invalid or expired meeting link');
  return accessToken;
}
