import { NextResponse } from 'next/server';

import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';
import {
  ParentModeRequiredError,
  requireParentActorContext,
} from '@iconicedu/web/lib/family-view/actor-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    const actor = await requireParentActorContext(supabase);

    await updateLearningSpaceFromPayload(learningSpaceId, payload!, {
      orgId: actor.account.org_id,
      actorProfileId: actor.profile.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ParentModeRequiredError) {
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
