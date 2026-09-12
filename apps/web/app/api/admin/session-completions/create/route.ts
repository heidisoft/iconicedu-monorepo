import { NextResponse } from 'next/server';

import { createSessionCompletionAsAdmin } from '@iconicedu/web/lib/api/session-completions';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type CreateRequestBody = {
  orgId?: string;
  scheduleId?: string;
  occurrenceKey?: string;
  sessionEndAt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateRequestBody | null;
  const { orgId, scheduleId, occurrenceKey, sessionEndAt } = body ?? {};

  if (!orgId || !scheduleId || !occurrenceKey || !sessionEndAt) {
    return NextResponse.json(
      {
        success: false,
        message: 'orgId, scheduleId, occurrenceKey, and sessionEndAt are required',
      },
      { status: 400 },
    );
  }

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const result = await createSessionCompletionAsAdmin(supabase, {
      orgId,
      scheduleId,
      occurrenceKey,
      sessionEndAt,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to create session.',
      },
      { status: 500 },
    );
  }
}
