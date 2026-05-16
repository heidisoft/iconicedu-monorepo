import { NextResponse } from 'next/server';

import type { SubmitCompletionVoteInput } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    throw error;
  }
  if (!actor) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const body = (await request
    .json()
    .catch(() => null)) as SubmitCompletionVoteInput | null;

  if (
    !body ||
    !body.orgId ||
    !body.scheduleId ||
    !body.occurrenceKey ||
    !body.role ||
    !body.status ||
    !['confirmed', 'disputed'].includes(body.status)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (body.orgId !== actor.account.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const api = createApiClient(supabase);
    const response = await api.post<{ feedbackEnabled: boolean }>(
      '/activity-feed/session-completion-vote',
      body,
    );
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit vote' },
      { status: 500 },
    );
  }
}
