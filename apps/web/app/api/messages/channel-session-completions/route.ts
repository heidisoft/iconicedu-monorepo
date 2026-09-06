import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { listChannelSessionCompletions } from '@iconicedu/web/lib/api/session-completions';

// Cross-party completion state for the classroom Sessions tab. Kept separate from
// GET /api/messages/channel-schedules so a hiccup in the completion service never
// blocks the schedule list — the client treats a failure here as "no completions".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const { completions, disputed } = await listChannelSessionCompletions(supabase, {
    orgId: accountResponse.data.org_id,
    channelId,
  });

  return NextResponse.json({ success: true, completions, disputed });
}
