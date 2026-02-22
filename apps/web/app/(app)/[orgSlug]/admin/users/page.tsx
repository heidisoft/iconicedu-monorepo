import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminUserRows } from '@iconicedu/web/lib/admin/users';
import { UsersTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table';

export const metadata: Metadata = {
  title: 'Admin · Users',
  description: 'Manage enrolled users, families, educators, and staff.',
};

export default async function AdminUsersPage() {
  const rows = await getAdminUserRows();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Users" description="Enrolled accounts" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <UsersTable rows={rows} />
      </div>
    </div>
  );
}
