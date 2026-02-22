import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminFamilyRows } from '@iconicedu/web/lib/admin/families';
import { FamiliesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/families/families-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Families',
  description: 'Browse families, links, and pending invites.',
};

export default async function AdminFamiliesPage() {
  const rows = await getAdminFamilyRows();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Manage families" description="View families, guardians, and invites." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <FamiliesDashboard rows={rows} />
      </div>
    </div>
  );
}
