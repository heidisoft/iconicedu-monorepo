import type {
  LearningSpaceLifecycleAction,
  LearningSpaceLifecycleResult,
} from '@iconicedu/shared-types';

import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

/**
 * Archive, restore, or soft-delete a class through apps/api. The database
 * cascades the change to class channels, memberships, tutor DMs, and pending
 * reminders, and keeps every report (see docs/operations/class-archive-lifecycle.md).
 */
export async function runLearningSpaceLifecycle(
  action: LearningSpaceLifecycleAction,
  learningSpaceId: string,
): Promise<LearningSpaceLifecycleResult> {
  const { supabase, orgId } = await requireAdminAuthContext();
  const api = createApiClient(supabase);
  const path = `/admin/learning-spaces/${encodeURIComponent(learningSpaceId)}`;
  const body = { orgId };

  switch (action) {
    case 'archive':
      return api.post<LearningSpaceLifecycleResult>(`${path}/archive`, body);
    case 'restore':
      return api.post<LearningSpaceLifecycleResult>(`${path}/restore`, body);
    case 'delete':
      return api.delete<LearningSpaceLifecycleResult>(path, body);
  }
}
