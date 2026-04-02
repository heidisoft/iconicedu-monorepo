import { notFound } from 'next/navigation';

import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { getAdminReportsDashboard } from '@iconicedu/web/lib/admin/reports';

export async function loadAdminReportsDashboard(orgSlug: string) {
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  await getDashboardProfileContext(supabase, account.id);

  try {
    return await getAdminReportsDashboard(account.org_id);
  } catch {
    notFound();
  }
}
