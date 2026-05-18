import type { AdminActivityFeedAuditVM } from '@iconicedu/shared-types';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function getAdminActivityFeedAudit(
  orgId: string,
  options: { limit?: number } = {},
): Promise<AdminActivityFeedAuditVM> {
  if (!orgId) {
    return {
      generatedAt: new Date().toISOString(),
      totalCount: 0,
      unreadCount: 0,
      pipelineJobCount: 0,
      reminderJobCount: 0,
      verbSummaries: [],
      items: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const api = createApiClient(supabase);
  return api.get<AdminActivityFeedAuditVM>('/activity-feed/admin/audit', {
    orgId,
    limit: options.limit ?? 500,
  });
}
