import { NextResponse } from 'next/server';

import type { ChannelCreatePayload } from '@iconicedu/shared-types';
import { createAdminChannel } from '@iconicedu/web/lib/admin/channel-create';

export async function POST(request: Request) {
  const payload = (await request.json()) as ChannelCreatePayload;

  if (!payload?.basics?.topic?.trim()) {
    return NextResponse.json(
      { success: false, message: 'topic is required' },
      { status: 400 },
    );
  }

  try {
    const channelId = await createAdminChannel(payload);
    return NextResponse.json({ success: true, channelId });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
