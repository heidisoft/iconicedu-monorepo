import { NextResponse } from 'next/server';

import { ParentModeRequiredError } from '@iconicedu/web/lib/family-view/actor-context';
import { createLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-create';
import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';

function isValidPayload(payload: LearningSpaceCreatePayload) {
  if (!payload.basics?.title?.trim()) return false;
  if (!payload.basics?.kind) return false;
  if (!payload.basics?.iconKey) return false;
  if (!payload.participants?.length) return false;
  return true;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LearningSpaceCreatePayload;

  if (!isValidPayload(payload)) {
    return NextResponse.json(
      { success: false, message: 'Missing required class fields.' },
      { status: 400 },
    );
  }

  try {
    const result = await createLearningSpaceFromPayload(payload);
    return NextResponse.json({ success: true, data: result });
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
