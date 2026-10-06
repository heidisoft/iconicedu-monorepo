import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { InternalServerErrorException } from '@nestjs/common';
import type {
  WhiteboardAccessVM,
  WhiteboardDocumentVM,
  WhiteboardRole,
} from '@iconicedu/shared-types';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

export const hashWhiteboardToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Called only AFTER existing meeting authorization. A grant cannot elevate a guest to teacher. */
export async function issueWhiteboardAccess(
  sessionId: string,
  role: WhiteboardRole,
  displayName: string,
): Promise<WhiteboardAccessVM> {
  const db = createSupabaseServiceClient();
  const session = await db
    .from('channel_live_sessions')
    .select('org_id, channel_id, occurrence_key, started_by_profile_id, app_metadata')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (session.error || !session.data)
    throw new InternalServerErrorException('Unable to prepare whiteboard');
  const row = session.data;
  if (
    !(await evaluateApiBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomWhiteboard,
      distinctId: row.started_by_profile_id,
    }))
  )
    return { provider: 'zoom' };
  const meta = row.app_metadata as Record<string, unknown> | null;
  const settings = meta?.meetingSettings as
    | { whiteboard?: { provider?: string } }
    | undefined;
  if (settings?.whiteboard?.provider === 'zoom') return { provider: 'zoom' };
  // Scheduled occurrences survive video-room replacement. Ad-hoc calls receive an independent board.
  const scopeKey =
    meta?.scheduleId && row.occurrence_key
      ? `scheduled:${meta.scheduleId}:${row.occurrence_key}`
      : `ad-hoc:${sessionId}`;
  const initial: WhiteboardDocumentVM = {
    schemaVersion: 1,
    studentEditing: true,
    pages: [{ id: randomUUID(), title: 'Page 1', elements: [] }],
  };
  const board = await db.from('classroom_whiteboards').upsert(
    {
      org_id: row.org_id,
      channel_id: row.channel_id,
      scope_key: scopeKey,
      document: initial,
    },
    { onConflict: 'org_id,channel_id,scope_key', ignoreDuplicates: true },
  );
  if (board.error) throw new InternalServerErrorException('Unable to prepare whiteboard');
  const stored = await db
    .from('classroom_whiteboards')
    .select('id')
    .eq('org_id', row.org_id)
    .eq('channel_id', row.channel_id)
    .eq('scope_key', scopeKey)
    .single();
  if (stored.error)
    throw new InternalServerErrorException('Unable to prepare whiteboard');
  const token = randomBytes(32).toString('base64url');
  const access = await db.from('classroom_whiteboard_access').insert({
    token_hash: hashWhiteboardToken(token),
    board_id: stored.data.id,
    live_session_id: sessionId,
    role,
    display_name: displayName.slice(0, 100),
    last_seen_at: new Date(0).toISOString(),
    expires_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
  });
  if (access.error)
    throw new InternalServerErrorException('Unable to authorize whiteboard');
  return { provider: 'excalidraw', token, role };
}
