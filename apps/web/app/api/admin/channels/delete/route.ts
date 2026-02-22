import { NextResponse } from 'next/server';

import { deleteChannel } from '@iconicedu/web/lib/admin/channel-delete';

type DeleteChannelRequest = {
  channelId?: string;
};

export async function POST(request: Request) {
  const { channelId } = (await request.json()) as DeleteChannelRequest;

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  try {
    await deleteChannel(channelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
