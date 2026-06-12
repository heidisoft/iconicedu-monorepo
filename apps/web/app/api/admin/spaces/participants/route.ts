import { NextResponse } from 'next/server';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';

export async function GET() {
  try {
    const { orgId } = await requireAdminAuthContext();
    const participants = await getActiveParticipantProfiles(orgId);
    return NextResponse.json({ data: participants });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json(
      { data: [], message },
      { status: message === 'Unauthorized' ? 401 : 403 },
    );
  }
}
