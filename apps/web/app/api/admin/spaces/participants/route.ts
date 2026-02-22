import { NextResponse } from 'next/server';

import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: [] }, { status: 401 });
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  const orgId = accountResponse.data?.org_id ?? '';
  const participants = await getActiveParticipantProfiles(orgId);
  return NextResponse.json({ data: participants });
}
