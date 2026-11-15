import { NextResponse } from 'next/server';
import type { LearningSpaceLifecycleAction } from '@iconicedu/shared-types';

import { runLearningSpaceLifecycle } from '@iconicedu/web/lib/admin/learning-space-lifecycle';
import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';

type LearningSpaceLifecycleRequest = {
  learningSpaceId?: unknown;
};

function statusForError(error: unknown): number {
  if (error instanceof ApiHttpError) return error.status;
  if (error instanceof Error && error.message === 'Unauthorized') return 401;
  if (error instanceof Error && error.message === 'Forbidden') return 403;
  return 500;
}

/** Shared handler for the admin class archive / unarchive / delete routes. */
export async function handleLearningSpaceLifecycle(
  request: Request,
  action: LearningSpaceLifecycleAction,
) {
  const body = (await request
    .json()
    .catch(() => null)) as LearningSpaceLifecycleRequest | null;
  const learningSpaceId = body?.learningSpaceId;

  if (typeof learningSpaceId !== 'string' || !learningSpaceId) {
    return NextResponse.json(
      { success: false, message: 'learningSpaceId is required' },
      { status: 400 },
    );
  }

  try {
    const result = await runLearningSpaceLifecycle(action, learningSpaceId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: statusForError(error) },
    );
  }
}
