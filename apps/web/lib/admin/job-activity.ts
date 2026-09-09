import type {
  AdminJobActivityKind,
  AdminJobActivityOverviewVM,
} from '@iconicedu/shared-types';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function getAdminJobActivity(
  orgId: string,
  options: { kind?: AdminJobActivityKind; limit?: number } = {},
): Promise<AdminJobActivityOverviewVM> {
  if (!orgId) {
    return { generatedAt: new Date().toISOString(), groups: [] };
  }

  const supabase = await createSupabaseServerClient();
  const api = createApiClient(supabase);
  return api.get<AdminJobActivityOverviewVM>('/activity-feed/admin/job-activity', {
    orgId,
    kind: options.kind,
    limit: options.limit ?? 50,
  });
}
