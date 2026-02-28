import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { createSignedChannelFileUrl } from '@iconicedu/web/lib/messages/queries/file-url.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { success: false, message: 'path is required' },
      { status: 400 },
    );
  }

  const [orgId, channelId] = path.split('/');
  if (!orgId || !channelId) {
    return NextResponse.json(
      { success: false, message: 'invalid path' },
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

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);

  if (!profileResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Profile not found' },
      { status: 404 },
    );
  }

  if (accountResponse.data.org_id !== orgId) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 },
    );
  }

  const membershipResponse = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .eq('profile_id', profileResponse.data.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membershipResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 },
    );
  }

  const signedUrl = await createSignedChannelFileUrl(supabase, path);
  return NextResponse.redirect(signedUrl);
}
