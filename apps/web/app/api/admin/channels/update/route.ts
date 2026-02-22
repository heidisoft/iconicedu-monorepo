import { NextResponse } from 'next/server';

import type { ChannelCreatePayload } from '@iconicedu/shared-types';
import { updateChannelFromPayload } from '@iconicedu/web/lib/admin/channel-update';

type UpdateChannelRequest = {
  channelId?: string;
  payload?: ChannelCreatePayload;
};

function isValidPayload(payload?: ChannelCreatePayload) {
  if (!payload) return false;
  if (!payload.basics?.topic?.trim()) return false;
  if (!payload.basics?.kind) return false;
  if (!payload.basics?.purpose) return false;
  if (!payload.basics?.visibility) return false;
  if (!payload.postingPolicy?.kind) return false;
  return true;
}

export async function POST(request: Request) {
  const { channelId, payload } = (await request.json()) as UpdateChannelRequest;

  if (!channelId || !isValidPayload(payload)) {
    return NextResponse.json(
      { success: false, message: 'Missing required channel fields.' },
      { status: 400 },
    );
  }

  try {
    await updateChannelFromPayload(channelId, payload!);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
