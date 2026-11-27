import { referralRequestOrigin } from '@iconicedu/web/lib/referrals/request-origin';
import { cookies } from 'next/headers';
import { getReferralEntryState } from '@iconicedu/web/lib/referrals/referral-entry-state';
import { NextResponse } from 'next/server';
import { enableParentReferrals } from '@iconicedu/web/flags';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import type { ParentReferralLanding } from '@iconicedu/shared-types';
import {
  isParentReferralCode,
  PARENT_REFERRAL_COOKIE,
  PARENT_REFERRAL_CANCELLED_COOKIE,
  PARENT_REFERRAL_COOKIE_MAX_AGE,
} from '@iconicedu/web/lib/referrals/referral-cookie';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await enableParentReferrals())) return new NextResponse(null, { status: 404 });
  const origin = referralRequestOrigin(request);
  if (request.headers.get('origin') !== referralRequestOrigin(request))
    return new NextResponse(null, { status: 403 });
  const { code } = await params;
  if (!isParentReferralCode(code)) return new NextResponse(null, { status: 404 });
  const entryState = await getReferralEntryState();
  if (entryState !== 'guest')
    return NextResponse.json(
      {
        message:
          entryState === 'signed_in'
            ? 'Referral invitations are for new parent accounts only.'
            : 'Unable to check your account. Please try again.',
      },
      {
        status: entryState === 'signed_in' ? 403 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
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
    new URL(`/${invitation.orgSlug}/get-started`, origin),
    303,
  );
  response.cookies.set(PARENT_REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PARENT_REFERRAL_COOKIE_MAX_AGE,
  });
  // Clear only a tombstone already present when this new acceptance was submitted.
  if ((await cookies()).get(PARENT_REFERRAL_CANCELLED_COOKIE)?.value === code)
    response.cookies.delete(PARENT_REFERRAL_CANCELLED_COOKIE);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
