import { referralRequestOrigin } from '@iconicedu/web/lib/referrals/request-origin';
import type { ParentReferralLanding } from '@iconicedu/shared-types';
import { ApiHttpError, createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { enableParentReferrals } from '@iconicedu/web/flags';
import {
  isParentReferralCode,
  PARENT_REFERRAL_COOKIE,
  PARENT_REFERRAL_CANCELLED_COOKIE,
} from '@iconicedu/web/lib/referrals/referral-cookie';
import { proxyPostToApi } from '@iconicedu/web/app/api/_lib/proxy-to-api';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== referralRequestOrigin(request))
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request' },
      { status: 400 },
    );
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json(
      { success: false, message: 'Invalid request' },
      { status: 400 },
    );
  const { referralCode: rawCode, referrerName, ...rest } = body;
  const enabled = await enableParentReferrals();
  const cookieStore = await cookies();
  const cookieCode = cookieStore.get(PARENT_REFERRAL_COOKIE)?.value;
  // Callback URLs may cross browsers; a code is attribution only and is validated by the API.
  let code = isParentReferralCode(cookieCode) ? cookieCode : rawCode;
  const cancelled =
    isParentReferralCode(code) &&
    cookieStore.get(PARENT_REFERRAL_CANCELLED_COOKIE)?.value === code;
  if (cancelled) code = undefined;
  if (
    enabled &&
    body.role === 'parent' &&
    body.skipReferral !== true &&
    isParentReferralCode(code)
  ) {
    try {
      await createPublicApiClient().get<ParentReferralLanding>(
        `/referrals/links/${code}`,
      );
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 404) code = undefined;
      else
        return NextResponse.json(
          {
            success: false,
            message:
              'Unable to confirm your invitation. Retry or remove the referral to continue.',
          },
          { status: 503 },
        );
    }
  }
  const payload = {
    ...rest,
    ...(enabled && !cancelled && body.role === 'parent' && body.skipReferral !== true
      ? { referrerName, ...(isParentReferralCode(code) ? { referralCode: code } : {}) }
      : {}),
  };
  const response = await proxyPostToApi(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(payload),
    }),
    '/onboarding/role',
  );
  if (response.ok && enabled) response.cookies.delete(PARENT_REFERRAL_COOKIE);
  return response;
}
