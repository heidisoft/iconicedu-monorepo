import { handleLearningSpaceLifecycle } from '@iconicedu/web/lib/admin/learning-space-lifecycle-route';

export async function POST(request: Request) {
  return handleLearningSpaceLifecycle(request, 'restore');
}
