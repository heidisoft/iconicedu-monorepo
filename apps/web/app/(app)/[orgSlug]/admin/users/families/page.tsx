import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminFamilyRows } from '@iconicedu/web/lib/admin/families';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { FamiliesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/families/families-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Families',
  description: 'Browse families, links, and pending invites.',
};

export default async function AdminFamiliesPage({
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

  const rows = await getAdminFamilyRows(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Manage families" description="View families, guardians, and invites." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <FamiliesDashboard rows={rows} />
      </div>
    </div>
  );
}
