import { referralRequestOrigin } from '@iconicedu/web/lib/referrals/request-origin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  isParentReferralCode,
  PARENT_REFERRAL_COOKIE,
  PARENT_REFERRAL_CANCELLED_COOKIE,
  PARENT_REFERRAL_COOKIE_MAX_AGE,
} from '@iconicedu/web/lib/referrals/referral-cookie';

/** Cookie cleanup stays available when the rollout is off. It never grants referral access. */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== referralRequestOrigin(request))
    return new NextResponse(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!isParentReferralCode(body?.code)) return new NextResponse(null, { status: 400 });
  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
  const store = await cookies();
  if (store.get(PARENT_REFERRAL_COOKIE)?.value === body.code)
    response.cookies.delete(PARENT_REFERRAL_COOKIE);
  response.cookies.set(PARENT_REFERRAL_CANCELLED_COOKIE, body.code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PARENT_REFERRAL_COOKIE_MAX_AGE,
  });
  return response;
}
