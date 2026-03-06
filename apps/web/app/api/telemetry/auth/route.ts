import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getDefaultOrg, getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';

const ALLOWED_EVENTS = new Set([
  'auth_start_google',
  'auth_start_email',
  'auth_magiclink_sent',
  'auth_success',
  'onboarding_role_selected',
  'onboarding_invitecode_submitted',
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    event?: unknown;
    payload?: unknown;
  } | null;

  const event = typeof body?.event === 'string' ? body.event.trim() : '';
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json(
      { success: false, message: 'Invalid telemetry event' },
      { status: 400 },
    );
  }

  const payload =
    body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload
      : null;
  const requestUrl = new URL(request.url);
  const orgSlugFromQuery = requestUrl.searchParams.get('org');
  const orgSlugFromPayload =
    payload && 'orgSlug' in payload && typeof payload.orgSlug === 'string'
      ? payload.orgSlug.trim()
      : '';

  const sessionSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();

  const serviceSupabase = createSupabaseServiceClient();
  let accountId: string | null = null;
  let orgId: string | null = null;
  if (user?.id) {
    const accountResponse = await getAccountByAuthUserId(serviceSupabase, user.id);
    accountId = accountResponse.data?.id ?? null;
    orgId = accountResponse.data?.org_id ?? null;
  }

  if (!orgId) {
    const slug = orgSlugFromQuery?.trim() || orgSlugFromPayload;
    if (slug) {
      const orgResponse = await getOrgBySlug(serviceSupabase, slug);
      orgId = orgResponse.data?.id ?? null;
    }
  }

  if (!orgId) {
    const defaultOrgResponse = await getDefaultOrg(serviceSupabase);
    orgId = defaultOrgResponse.data?.id ?? null;
  }

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'No organization found for telemetry event' },
      { status: 400 },
    );
  }

  const insertResponse = await serviceSupabase.from('auth_telemetry_events').insert({
    org_id: orgId,
    account_id: accountId,
    auth_user_id: user?.id ?? null,
    event_key: event,
    payload,
  });

  if (insertResponse.error) {
    return NextResponse.json(
      { success: false, message: insertResponse.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
