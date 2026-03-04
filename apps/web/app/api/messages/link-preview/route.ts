import { NextResponse } from 'next/server';

import {
  fetchLinkPreviewMetadata,
  isSafeLinkPreviewUrl,
} from '@iconicedu/web/lib/messages/link-preview';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, message: 'url is required' },
      { status: 400 },
    );
  }

  if (!isSafeLinkPreviewUrl(url)) {
    return NextResponse.json(
      { success: false, message: 'url is not allowed' },
      { status: 400 },
    );
  }

  try {
    const metadata = await fetchLinkPreviewMetadata(url);
    return NextResponse.json({ success: true, data: metadata });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to fetch link preview',
      },
      { status: 500 },
    );
  }
}
