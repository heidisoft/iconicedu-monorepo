import { NextResponse } from 'next/server';

import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByEmail } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';

type LoginEligibilityBody = {
  orgSlug?: unknown;
  email?: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginEligibilityBody | null;
  const orgSlugRaw = typeof body?.orgSlug === 'string' ? body.orgSlug.trim().toLowerCase() : '';
  const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!orgSlugRaw) {
    return NextResponse.json(
      { eligible: false, message: 'Organization is required.' },
      { status: 400 },
    );
  }

  if (!EMAIL_REGEX.test(emailRaw)) {
    return NextResponse.json(
      { eligible: false, message: 'Valid email is required.' },
      { status: 400 },
    );
  }

  const serviceSupabase = createSupabaseServiceClient();
  const orgResponse = await getOrgBySlug(serviceSupabase, orgSlugRaw);

  if (orgResponse.error) {
    return NextResponse.json(
      { eligible: false, message: orgResponse.error.message },
      { status: 500 },
    );
  }

  if (!orgResponse.data) {
    return NextResponse.json(
      { eligible: false, message: 'Organization not found.' },
      { status: 404 },
    );
  }

  const accountResponse = await getAccountByEmail(serviceSupabase, orgResponse.data.id, emailRaw);

  if (accountResponse.error) {
    return NextResponse.json(
      { eligible: false, message: accountResponse.error.message },
      { status: 500 },
    );
  }

  if (!accountResponse.data || accountResponse.data.status === 'deleted') {
    return NextResponse.json({
      eligible: false,
      message: 'No existing account found for this organization. Use Get started instead.',
    });
  }

  if (accountResponse.data.status === 'suspended') {
    return NextResponse.json({
      eligible: false,
      message: 'This account is suspended. Contact support for help.',
    });
  }

  return NextResponse.json({ eligible: true });
}
