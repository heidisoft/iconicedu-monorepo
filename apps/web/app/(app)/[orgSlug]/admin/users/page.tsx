import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminUserRows } from '@iconicedu/web/lib/admin/users';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { UsersTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table';

export const metadata: Metadata = {
  title: 'Admin · Users',
  description: 'Manage enrolled users, families, educators, and staff.',
};

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  let rows: Awaited<ReturnType<typeof getAdminUserRows>> = [];
  try {
    rows = await getAdminUserRows(org.id);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Users" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <UsersTable rows={rows} />
      </div>
    </div>
  );
}
