import { NextResponse } from 'next/server';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const ACTIONS = new Set(['confirm', 'dispute', 'rate']);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await context.params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.orgId !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const response = await createApiClient(supabase).post(
      `/session-completions/${id}/${action}`,
      body,
    );
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to update session completion',
      },
      { status: 500 },
    );
  }
}
