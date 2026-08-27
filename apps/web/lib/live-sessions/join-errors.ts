import { NextResponse } from 'next/server';
import type { ClassSessionJoinIneligibleReasonVM } from '@iconicedu/shared-types';

/**
 * Turn an API join failure into a user-safe web response.
 *
 * The API answers with a stable machine reason; this maps it to a status and a
 * message that is safe to show. A failed join must never look like a success —
 * the caller navigating to some other classroom on error is exactly the silent
 * mis-navigation issue #195 calls out.
 */
const REASON_MESSAGES: Record<ClassSessionJoinIneligibleReasonVM, string> = {
  not_authorized: 'You do not have access to this class session.',
  live_sessions_disabled: 'Live sessions are not enabled for this classroom.',
  classroom_archived: 'Archived classrooms cannot start or join live sessions.',
  occurrence_not_found: 'This class session could not be found.',
  occurrence_cancelled: 'This class session has been cancelled.',
  occurrence_past: 'This class session has already ended.',
  feature_disabled: 'This class session is not open to join yet.',
};

const REASON_STATUS: Record<ClassSessionJoinIneligibleReasonVM, number> = {
  not_authorized: 403,
  live_sessions_disabled: 409,
  classroom_archived: 409,
  occurrence_not_found: 404,
  occurrence_cancelled: 409,
  occurrence_past: 409,
  feature_disabled: 403,
};

function isIneligibleReason(value: string): value is ClassSessionJoinIneligibleReasonVM {
  return value in REASON_MESSAGES;
}

export function resolveLiveSessionJoinErrorResponse(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : 'Failed to join live session';

  if (isIneligibleReason(rawMessage)) {
    return NextResponse.json(
      { success: false, error: REASON_MESSAGES[rawMessage], reason: rawMessage },
      { status: REASON_STATUS[rawMessage] },
    );
  }

  if (rawMessage === 'Unauthorized') {
    return NextResponse.json(
      {
        success: false,
        error: REASON_MESSAGES.not_authorized,
        reason: 'not_authorized' satisfies ClassSessionJoinIneligibleReasonVM,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: false, error: rawMessage }, { status: 500 });
}
