import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { UsersTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table';
import { AdminPageShell } from '@iconicedu/web/components/admin/admin-page-layout';

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

  return (
    <AdminPageShell title="Users">
      <UsersTable orgSlug={orgSlug} />
    </AdminPageShell>
  );
}
