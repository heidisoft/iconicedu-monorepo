import { NextResponse } from 'next/server';
import { enableParentReferrals } from '@iconicedu/web/flags';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import type { ParentReferralLanding } from '@iconicedu/shared-types';
import {
  isParentReferralCode,
  PARENT_REFERRAL_COOKIE,
  PARENT_REFERRAL_COOKIE_MAX_AGE,
} from '@iconicedu/web/lib/referrals/referral-cookie';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await enableParentReferrals())) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin)
    return new NextResponse(null, { status: 403 });
  const { code } = await params;
  if (!isParentReferralCode(code)) return new NextResponse(null, { status: 404 });
  let invitation: ParentReferralLanding;
  try {
    invitation = await createPublicApiClient().get<ParentReferralLanding>(
      `/referrals/links/${code}`,
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(invitation.orgSlug))
    return new NextResponse(null, { status: 404 });
  const response = NextResponse.redirect(
    new URL(`/${invitation.orgSlug}/get-started`, url.origin),
    303,
  );
  response.cookies.set(PARENT_REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PARENT_REFERRAL_COOKIE_MAX_AGE,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
