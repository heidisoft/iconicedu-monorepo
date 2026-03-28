import { NextResponse } from 'next/server';

import { getAdminUserProfilePreview } from '@iconicedu/web/lib/admin/user-profile-preview';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('accountId')?.trim() ?? '';

  if (!accountId) {
    return NextResponse.json(
      { success: false, message: 'accountId is required' },
      { status: 400 },
    );
  }

  try {
    const payload = await getAdminUserProfilePreview(accountId);

    if (!payload) {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to load profile preview',
      },
      { status: 500 },
    );
  }
}
