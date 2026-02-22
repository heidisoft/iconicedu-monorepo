import { NextResponse } from 'next/server';

import { unarchiveLearningSpace } from '@iconicedu/web/lib/admin/learning-space-unarchive';

type UnarchiveLearningSpaceRequest = {
  learningSpaceId?: string;
};

export async function POST(request: Request) {
  const { learningSpaceId } = (await request.json()) as UnarchiveLearningSpaceRequest;

  if (!learningSpaceId) {
    return NextResponse.json(
      { success: false, message: 'learningSpaceId is required' },
      { status: 400 },
    );
  }

  try {
    await unarchiveLearningSpace(learningSpaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
