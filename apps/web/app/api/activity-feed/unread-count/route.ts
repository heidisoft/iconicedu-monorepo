import { NextResponse } from 'next/server';

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildActivityFeedUnreadCountForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const unreadCount = await buildActivityFeedUnreadCountForProfile(
    supabase,
    accountResponse.data.org_id,
    profileResponse.data.id,
  );

  return NextResponse.json({ unreadCount });
}
