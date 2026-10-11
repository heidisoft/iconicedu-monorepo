import { createHash, randomBytes } from 'node:crypto';
import { InternalServerErrorException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
export const hashAnnotationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
/** Only call after the owning meeting join verifies admission and the passcode. */
export async function issueAnnotationAccess(
  sessionId: string,
  displayName: string,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const result = await createSupabaseServiceClient()
    .from('screen_annotation_access')
    .insert({
      live_session_id: sessionId,
      token_hash: hashAnnotationToken(token),
      display_name: displayName.slice(0, 100),
      expires_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
    });
  if (result.error)
    throw new InternalServerErrorException('Unable to authorize annotations');
  return token;
}
