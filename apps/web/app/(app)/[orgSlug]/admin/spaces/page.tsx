import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminLearningSpaceRows } from '@iconicedu/web/lib/admin/learning-spaces';
import { LearningSpacesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-spaces-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Learning spaces',
  description: 'Review and manage learning spaces, subjects, and visibility settings.',
};

export default async function AdminLearningSpacesPage() {
  const rows = await getAdminLearningSpaceRows();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Learning spaces" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <LearningSpacesDashboard rows={rows} />
      </div>
    </div>
  );
}
