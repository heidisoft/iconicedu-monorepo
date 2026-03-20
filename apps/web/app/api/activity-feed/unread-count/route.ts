import { NextResponse } from 'next/server';

import { buildActivityFeedUnreadCountForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId')?.trim() || undefined;
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase, orgId ? { orgId } : undefined);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const unreadCount = await buildActivityFeedUnreadCountForProfile(
    supabase,
    actor.account.org_id,
    actor.profile.id,
  );

  return NextResponse.json({ unreadCount });
}
