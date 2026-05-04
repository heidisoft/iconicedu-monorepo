import { NextResponse } from 'next/server';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';
import { ParentModeRequiredError } from '@iconicedu/web/lib/family-view/actor-context';
import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';

type UpdateLearningSpaceRequest = {
  learningSpaceId?: string;
  payload?: LearningSpaceCreatePayload;
};

function isValidPayload(payload?: LearningSpaceCreatePayload) {
  if (!payload) return false;
  if (!payload.basics?.title?.trim()) return false;
  if (!payload.basics?.kind) return false;
  if (!payload.basics?.iconKey) return false;
  if (!payload.participants?.length) return false;
  return true;
}

export async function POST(request: Request) {
  const { learningSpaceId, payload } =
    (await request.json()) as UpdateLearningSpaceRequest;

  if (!learningSpaceId || !isValidPayload(payload)) {
    return NextResponse.json(
      { success: false, message: 'Missing required class fields.' },
      { status: 400 },
    );
  }

  try {
    const auth = await requireAdminAuthContext();

    await updateLearningSpaceFromPayload(learningSpaceId, payload!, {
      orgId: auth.orgId,
      actorProfileId: auth.profileId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ParentModeRequiredError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
