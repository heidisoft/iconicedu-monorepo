import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { hashMeetingLink } from './meeting-browser-links';
import type { MeetingAdmissionVM } from '@iconicedu/shared-types';
export async function requireMeetingAdmission(
  sessionId: string,
  token: string | undefined,
  identity: string,
  displayName: string,
) {
  if (!token || !/^[\w-]{32}$/.test(token))
    throw new BadRequestException('Admission token is required');
  const result = await createSupabaseServiceClient().rpc('request_meeting_admission', {
    p_session: sessionId,
    p_token_hash: hashMeetingLink(token),
    p_identity_hash: hashMeetingLink(identity),
    p_name: displayName,
  });
  if (result.error) throw new InternalServerErrorException('Unable to request admission');
  if (result.data === 'approved') return;
  if (result.data !== 'waiting')
    throw new ForbiddenException('Your request to join was declined or expired');
  throw new HttpException(
    {
      message: 'Waiting for a teacher to let you in',
      admission: { token, status: 'waiting' } satisfies MeetingAdmissionVM,
    },
    409,
  );
}
export async function meetingAdmissionStatus(
  sessionId: string,
  token: string,
  cancel = false,
): Promise<MeetingAdmissionVM> {
  if (!/^[\w-]{32}$/.test(token))
    throw new BadRequestException('Invalid admission token');
  const db = createSupabaseServiceClient();
  if (cancel) {
    const cancelled = await db
      .from('live_session_admissions')
      .update({ status: 'denied' })
      .eq('live_session_id', sessionId)
      .eq('token_hash', hashMeetingLink(token))
      .eq('status', 'waiting');
    if (cancelled.error)
      throw new InternalServerErrorException('Unable to cancel request');
  }
  const session = await db
    .from('channel_live_sessions')
    .select('status')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (session.error) throw new InternalServerErrorException('Unable to check meeting');
  if (!session.data || !['starting', 'live'].includes(session.data.status))
    return { token, status: 'ended' };
  const result = await db
    .from('live_session_admissions')
    .select('status')
    .eq('live_session_id', sessionId)
    .eq('token_hash', hashMeetingLink(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (result.error) throw new InternalServerErrorException('Unable to check admission');
  return { token, status: result.data?.status ?? 'denied' };
}
