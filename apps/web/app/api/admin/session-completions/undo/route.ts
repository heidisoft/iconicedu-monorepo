import { NextResponse } from 'next/server';

import { undoSessionCompletionAsAdmin } from '@iconicedu/web/lib/api/session-completions';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type UndoRequestBody = {
  orgId?: string;
  scheduleId?: string;
  occurrenceKey?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UndoRequestBody | null;
  const { orgId, scheduleId, occurrenceKey } = body ?? {};

  if (!orgId || !scheduleId || !occurrenceKey) {
    return NextResponse.json(
      { success: false, message: 'orgId, scheduleId, and occurrenceKey are required' },
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
    const result = await undoSessionCompletionAsAdmin(supabase, {
      orgId,
      scheduleId,
      occurrenceKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to undo confirmation.',
      },
      { status: 500 },
    );
  }
}
