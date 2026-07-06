import { NextResponse } from 'next/server';

import { getLearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';

type LearningSpaceDetailRequest = {
  learningSpaceId?: string;
};

export async function POST(request: Request) {
  const { learningSpaceId } = (await request.json()) as LearningSpaceDetailRequest;

  if (!learningSpaceId) {
    return NextResponse.json(
      { success: false, message: 'learningSpaceId is required' },
      { status: 400 },
    );
  }

  try {
    const detail = await getLearningSpaceDetail(learningSpaceId);
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
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
