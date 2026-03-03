import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  if (!accountResponse.data) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body?.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (!ids.length) {
    return NextResponse.json({ updated: 0 });
  }

  const now = new Date().toISOString();
  const updateResponse = await supabase
    .from('activity_feed_items')
    .update({
      is_read: true,
      read_at: now,
      updated_at: now,
      updated_by: profileResponse.data.id,
    })
    .eq('org_id', accountResponse.data.org_id)
    .eq('recipient_profile_id', profileResponse.data.id)
    .in('id', ids)
    .is('deleted_at', null);

  if (updateResponse.error) {
    return NextResponse.json({ error: updateResponse.error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: ids.length });
}
