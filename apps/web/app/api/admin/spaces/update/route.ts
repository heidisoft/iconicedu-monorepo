import { NextResponse } from 'next/server';

import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
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

    const accountResponse = await getAccountByAuthUserId(supabase, user.id);
    if (!accountResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 },
      );
    }

    const profileResponse = await getProfileByAccountId(
      supabase,
      accountResponse.data.id,
    );
    if (!profileResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 },
      );
    }

    await updateLearningSpaceFromPayload(learningSpaceId, payload!, {
      orgId: accountResponse.data.org_id,
      actorProfileId: profileResponse.data.id,
    });
    return NextResponse.json({ success: true });
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
