import { NextResponse } from 'next/server';

import { replaceLearningSpaceLinks } from '@iconicedu/web/lib/admin/learning-space-links';
import type { LearningSpaceResourcePayload } from '@iconicedu/shared-types';

type LearningSpaceLinksRequest = {
  learningSpaceId?: string;
  links?: LearningSpaceResourcePayload[];
};

export async function POST(request: Request) {
  const { learningSpaceId, links } = (await request.json()) as LearningSpaceLinksRequest;

  if (!learningSpaceId) {
    return NextResponse.json(
      { success: false, message: 'learningSpaceId is required' },
      { status: 400 },
    );
  }

  try {
    await replaceLearningSpaceLinks(learningSpaceId, links ?? []);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
