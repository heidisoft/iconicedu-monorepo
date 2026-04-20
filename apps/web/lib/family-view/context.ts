import { cookies } from 'next/headers';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

const FAMILY_VIEW_COOKIE_NAME = 'iconic_view_as_child_profile_id';
const FAMILY_VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

type FamilyViewCookiePayload = {
  orgId: string;
  guardianAccountId: string;
  childProfileId: string;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function resolveCookieSecret(): string {
  return (
    process.env.ICONIC_FAMILY_VIEW_COOKIE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_JWT_SECRET ??
    'iconic-family-view-dev-secret'
  );
}

function signPayload(payload: string): string {
  return createHmac('sha256', resolveCookieSecret()).update(payload).digest('base64url');
}

function createSignedCookieValue(payload: FamilyViewCookiePayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSignedCookieValue(value: string): FamilyViewCookiePayload | null {
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as FamilyViewCookiePayload;
    if (
      !payload ||
      typeof payload.orgId !== 'string' ||
      typeof payload.guardianAccountId !== 'string' ||
      typeof payload.childProfileId !== 'string' ||
      !payload.orgId.trim() ||
      !payload.guardianAccountId.trim() ||
      !payload.childProfileId.trim()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isMissingRequestScopeError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes('outside a request scope');
}

export async function getFamilyViewCookieSelection() {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch (error) {
    if (isMissingRequestScopeError(error)) {
      return null;
    }
    throw error;
  }
  const value = cookieStore.get(FAMILY_VIEW_COOKIE_NAME)?.value ?? null;
  if (!value) {
    return null;
  }
  return parseSignedCookieValue(value);
}

export async function setFamilyViewCookie(input: {
  orgId: string;
  guardianAccountId: string;
  childProfileId: string;
}) {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch (error) {
    if (isMissingRequestScopeError(error)) {
      return;
    }
    throw error;
  }
  cookieStore.set({
    name: FAMILY_VIEW_COOKIE_NAME,
    value: createSignedCookieValue({
      orgId: input.orgId,
      guardianAccountId: input.guardianAccountId,
      childProfileId: input.childProfileId,
    }),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: FAMILY_VIEW_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearFamilyViewCookie() {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch (error) {
    if (isMissingRequestScopeError(error)) {
      return;
    }
    throw error;
  }
  cookieStore.set({
    name: FAMILY_VIEW_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
