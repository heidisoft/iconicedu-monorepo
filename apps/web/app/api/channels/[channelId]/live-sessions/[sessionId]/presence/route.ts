import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const DAILY_REST_BASE_URL = process.env.DAILY_REST_BASE_URL ?? 'https://api.daily.co/v1';

type DailyPresenceParticipant = { id: string; userName?: string };
type DailyPresenceResponse = { data?: DailyPresenceParticipant[] };

export async function GET(
  _request: Request,
  context: { params: Promise<{ channelId: string; sessionId: string }> },
) {
  try {
    const { channelId, sessionId } = await context.params;

    // Auth — require a valid session
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ count: 0 }, { status: 401 });
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ count: 0 });
    }

    // Look up the Daily room name from the live session record
    const serviceSupabase = createSupabaseServiceClient();
    const { data: liveSession } = await serviceSupabase
      .from('channel_live_sessions')
      .select('provider_metadata')
      .eq('id', sessionId)
      .eq('channel_id', channelId)
      .maybeSingle<{ provider_metadata: Record<string, unknown> | null }>();

    const roomName =
      typeof liveSession?.provider_metadata?.roomName === 'string'
        ? liveSession.provider_metadata.roomName
        : null;

    if (!roomName) {
      return NextResponse.json({ count: 0 });
    }

    const res = await fetch(`${DAILY_REST_BASE_URL}/rooms/${roomName}/presence`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ count: 0 });
    }

    const body = (await res.json()) as DailyPresenceResponse;
    const participants = body.data ?? [];
    const names = participants
      .map((p) => p.userName?.trim())
      .filter((n): n is string => Boolean(n));

    return NextResponse.json({ count: participants.length, names });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
