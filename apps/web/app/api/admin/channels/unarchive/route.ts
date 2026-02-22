import { NextResponse } from 'next/server';

import { unarchiveChannel } from '@iconicedu/web/lib/admin/channel-unarchive';

type UnarchiveChannelRequest = {
  channelId?: string;
};

export async function POST(request: Request) {
  const { channelId } = (await request.json()) as UnarchiveChannelRequest;

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  try {
    await unarchiveChannel(channelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
