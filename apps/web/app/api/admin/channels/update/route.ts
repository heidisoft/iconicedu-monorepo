import { NextResponse } from 'next/server';

import { ParentModeRequiredError } from '@iconicedu/web/lib/family-view/actor-context';
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
    if (error instanceof ParentModeRequiredError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
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
