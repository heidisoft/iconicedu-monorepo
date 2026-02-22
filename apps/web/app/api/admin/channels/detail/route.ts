import { NextResponse } from 'next/server';

import { getChannelDetail } from '@iconicedu/web/lib/admin/channel-detail';

type ChannelDetailRequest = {
  channelId?: string;
};

export async function POST(request: Request) {
  const { channelId } = (await request.json()) as ChannelDetailRequest;

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  try {
    const detail = await getChannelDetail(channelId);
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
