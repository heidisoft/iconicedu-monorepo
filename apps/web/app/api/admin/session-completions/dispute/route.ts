import { NextResponse } from 'next/server';

import { disputeSessionCompletionAsAdmin } from '@iconicedu/web/lib/api/session-completions';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { ClassSessionCompletionDisputeCategory } from '@iconicedu/shared-types';

type DisputeRequestBody = {
  orgId?: string;
  scheduleId?: string;
  occurrenceKey?: string;
  disputeCategory?: ClassSessionCompletionDisputeCategory;
  disputeReason?: string | null;
  rescheduleRequested?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DisputeRequestBody | null;
  const {
    orgId,
    scheduleId,
    occurrenceKey,
    disputeCategory,
    disputeReason,
    rescheduleRequested,
  } = body ?? {};

  if (!orgId || !scheduleId || !occurrenceKey || !disputeCategory) {
    return NextResponse.json(
      {
        success: false,
        message: 'orgId, scheduleId, occurrenceKey, and disputeCategory are required',
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
    const result = await disputeSessionCompletionAsAdmin(supabase, {
      orgId,
      scheduleId,
      occurrenceKey,
      disputeCategory,
      disputeReason,
      rescheduleRequested,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to report session.',
      },
      { status: 500 },
    );
  }
}
