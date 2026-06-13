'use server';

import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function loadWhiteboardSnapshot(liveSessionId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from('whiteboard_sessions')
    .select('snapshot')
    .eq('live_session_id', liveSessionId)
    .maybeSingle();
  return (data?.snapshot ?? null) as Record<string, unknown> | null;
}

export async function saveWhiteboardSnapshot(
  liveSessionId: string,
  orgId: string,
  channelId: string,
  snapshot: Record<string, unknown>,
) {
  const supabase = createSupabaseServiceClient();
  await supabase.from('whiteboard_sessions').upsert(
    {
      live_session_id: liveSessionId,
      org_id: orgId,
      channel_id: channelId,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'live_session_id' },
  );
}
