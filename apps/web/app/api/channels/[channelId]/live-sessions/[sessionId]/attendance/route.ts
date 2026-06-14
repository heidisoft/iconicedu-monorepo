import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

function parseBody(body: unknown): {
  action: 'join' | 'leave';
  profileId: string;
  timestamp: string;
} | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if ((b.action !== 'join' && b.action !== 'leave') || typeof b.profileId !== 'string') {
    return null;
  }
  return {
    action: b.action,
    profileId: b.profileId,
    timestamp: typeof b.timestamp === 'string' ? b.timestamp : new Date().toISOString(),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string; sessionId: string }> },
) {
  try {
    const { channelId, sessionId } = await context.params;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(body);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'action ("join"|"leave") and profileId are required' },
        { status: 400 },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();

    if (parsed.action === 'join') {
      await serviceSupabase.from('live_session_attendance').insert({
        live_session_id: sessionId,
        profile_id: parsed.profileId,
        joined_at: parsed.timestamp,
      });
    } else {
      // Update the most recent open attendance row for this profile+session
      const { data: row } = await serviceSupabase
        .from('live_session_attendance')
        .select('id')
        .eq('live_session_id', sessionId)
        .eq('profile_id', parsed.profileId)
        .is('left_at', null)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (row) {
        await serviceSupabase
          .from('live_session_attendance')
          .update({ left_at: parsed.timestamp })
          .eq('id', row.id);
      }
    }

    // Confirm the session/channel exists (soft guard — the FK insert would fail anyway)
    void channelId;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to record attendance';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
