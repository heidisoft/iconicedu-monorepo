import { NextResponse } from 'next/server';

import { getActiveParticipantProfiles } from '@iconicedu/web/lib/admin/participants';

export async function GET() {
  const participants = await getActiveParticipantProfiles();
  return NextResponse.json({ data: participants });
}
