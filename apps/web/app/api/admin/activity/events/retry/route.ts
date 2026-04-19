import { NextResponse } from 'next/server';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type RetryActivityEventRequest = {
  eventId?: string;
  orgId?: string;
};

function resolveInternalApiUrl() {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(
    /\/+$/,
    '',
  );
}

function resolveInternalActivityFeedToken() {
  return process.env.INTERNAL_ACTIVITY_FEED_TOKEN?.trim() || '';
}

function isAllowedAdminRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin';
}

async function parseInternalResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(errorBody?.message ?? `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as RetryActivityEventRequest | null;
  const eventId = body?.eventId;
  const orgId = body?.orgId;

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  if (!eventId) {
    return NextResponse.json(
      { success: false, message: 'eventId is required' },
      { status: 400 },
    );
  }

  try {
    const internalApiUrl = resolveInternalApiUrl();
    const supabase = await createSupabaseServerClient();
    const authUser = await requireAuthedUser(supabase);
    const accountResponse = await getAccountByAuthUserIdInOrg(
      supabase,
      authUser.id,
      orgId,
    );

    if (!accountResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    const rolesResponse = await getUserRoles(
      supabase,
      accountResponse.data.id,
      accountResponse.data.org_id,
    );
    if (rolesResponse.error) {
      return NextResponse.json(
        { success: false, message: rolesResponse.error.message },
        { status: 500 },
      );
    }

    const hasAdminRole = (rolesResponse.data ?? []).some((role) =>
      isAllowedAdminRole(role.role_key),
    );
    if (!hasAdminRole) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const eventResponse = await supabase
      .from('activity_events')
      .select('id')
      .eq('id', eventId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (eventResponse.error) {
      return NextResponse.json(
        { success: false, message: eventResponse.error.message },
        { status: 500 },
      );
    }

    if (!eventResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 },
      );
    }

    const token = resolveInternalActivityFeedToken();
    if (!internalApiUrl || !token) {
      throw new Error(
        'API_URL/NEXT_PUBLIC_API_URL and INTERNAL_ACTIVITY_FEED_TOKEN are required',
      );
    }

    const result = await parseInternalResponse<{ processed: number }>(
      await fetch(`${internalApiUrl}/internal/activity-feed/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventIds: [eventId],
          limit: 1,
        }),
      }),
    );

    if (!result.processed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Event could not be retried. It may have reached the retry limit.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, processed: result.processed });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
