import { NextResponse } from 'next/server';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type ProjectionStatus = 'pending' | 'processing' | 'failed';

function isAllowedAdminRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin' || roleKey === 'staff';
}

async function countByProjectionStatus(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  orgId: string;
  status: ProjectionStatus;
}) {
  const response = await input.supabase
    .from('activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', input.orgId)
    .eq('projection_status', input.status)
    .is('deleted_at', null);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.count ?? 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  const limitRaw = Number(searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.round(limitRaw)))
    : 50;

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  try {
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

    const serviceSupabase = createSupabaseServiceClient();
    const [failedResponse, failedCount, pendingCount, processingCount] =
      await Promise.all([
        serviceSupabase
          .from('activity_events')
          .select(
            'id, event_type, occurred_at, projection_status, projection_attempts, last_projection_error, updated_at, dedupe_key',
            { count: 'exact' },
          )
          .eq('org_id', orgId)
          .eq('projection_status', 'failed')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(limit),
        countByProjectionStatus({ supabase: serviceSupabase, orgId, status: 'failed' }),
        countByProjectionStatus({ supabase: serviceSupabase, orgId, status: 'pending' }),
        countByProjectionStatus({
          supabase: serviceSupabase,
          orgId,
          status: 'processing',
        }),
      ]);

    if (failedResponse.error) {
      return NextResponse.json(
        { success: false, message: failedResponse.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      summary: {
        failed: failedCount,
        pending: pendingCount,
        processing: processingCount,
      },
      totalFailed: failedResponse.count ?? failedCount,
      events: failedResponse.data ?? [],
    });
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
