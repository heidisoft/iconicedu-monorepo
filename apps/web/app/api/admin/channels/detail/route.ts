import { NextResponse } from 'next/server';

import { getChannelDetail } from '@iconicedu/web/lib/admin/channel-detail';
import { AdminOrgContextError } from '@iconicedu/web/lib/admin/require-admin-org-context';

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
    if (error instanceof AdminOrgContextError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
