import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSignedChannelFileUrl } from '@iconicedu/web/lib/messages/queries/file-url.query';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

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
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 },
      );
    }
    throw error;
  }

  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  if (actor.account.org_id !== orgId) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const membershipResponse = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .eq('profile_id', actor.profile.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membershipResponse.data) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const signedUrl = await createSignedChannelFileUrl(supabase, path);
  return NextResponse.redirect(signedUrl);
}
