import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const DAILY_REST_BASE_URL = process.env.DAILY_REST_BASE_URL ?? 'https://api.daily.co/v1';

function getDailyApiKey() {
  return process.env.DAILY_API_KEY ?? null;
}

function parseAction(body: unknown): 'start' | 'stop' | null {
  if (typeof body !== 'object' || body === null) return null;
  const action = (body as Record<string, unknown>).action;
  return action === 'start' || action === 'stop' ? action : null;
}

function parseRecordingId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const id = (body as Record<string, unknown>).recordingId;
  return typeof id === 'string' ? id : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string; sessionId: string }> },
) {
  try {
    const { channelId, sessionId } = await context.params;
    const apiKey = getDailyApiKey();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Daily API not configured' },
        { status: 503 },
      );
    }

    // Verify caller is an authenticated channel member
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

    const serviceSupabase = createSupabaseServiceClient();

    // Confirm the live session exists and get the provider session id (room name)
    const { data: session, error: sessionError } = await serviceSupabase
      .from('channel_live_sessions')
      .select('id, channel_id, provider_session_id, metadata')
      .eq('id', sessionId)
      .eq('channel_id', channelId)
      .maybeSingle<{
        id: string;
        channel_id: string;
        provider_session_id: string | null;
        metadata: Record<string, unknown> | null;
      }>();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Live session not found' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    const action = parseAction(body);

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action must be "start" or "stop"' },
        { status: 400 },
      );
    }

    if (action === 'start') {
      if (!session.provider_session_id) {
        return NextResponse.json(
          { success: false, error: 'No active Daily room for this session' },
          { status: 422 },
        );
      }

      const res = await fetch(`${DAILY_REST_BASE_URL}/recordings/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ roomName: session.provider_session_id }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json(
          { success: false, error: `Daily API error: ${errText}` },
          { status: res.status },
        );
      }

      const data = (await res.json()) as { id?: string };
      const recordingId = data.id ?? null;

      // Persist recording ID in session metadata
      await serviceSupabase
        .from('channel_live_sessions')
        .update({
          metadata: {
            ...(session.metadata ?? {}),
            recordingId,
            recordingStartedAt: new Date().toISOString(),
          },
        })
        .eq('id', sessionId);

      return NextResponse.json({ success: true, recordingId, status: 'recording' });
    }

    // action === 'stop'
    const recordingId =
      parseRecordingId(body) ?? (session.metadata?.recordingId as string | null);

    if (!recordingId) {
      return NextResponse.json(
        { success: false, error: 'No active recording ID found' },
        { status: 422 },
      );
    }

    const res = await fetch(`${DAILY_REST_BASE_URL}/recordings/${recordingId}/stop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Daily API error: ${errText}` },
        { status: res.status },
      );
    }

    await serviceSupabase
      .from('channel_live_sessions')
      .update({
        metadata: {
          ...(session.metadata ?? {}),
          recordingId: null,
          recordingStoppedAt: new Date().toISOString(),
        },
      })
      .eq('id', sessionId);

    return NextResponse.json({ success: true, status: 'stopped' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle recording';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
