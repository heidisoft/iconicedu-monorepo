import { NextResponse } from 'next/server';

import { archiveChannel } from '@iconicedu/web/lib/admin/channel-archive';

type ArchiveChannelRequest = {
  channelId?: string;
};

export async function POST(request: Request) {
  const { channelId } = (await request.json()) as ArchiveChannelRequest;

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  try {
    await archiveChannel(channelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
