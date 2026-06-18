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
      <DashboardHeader title="Manage families" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage family groups, guardians, and their children.
            </p>
          </div>
        </div>
        <FamiliesDashboard rows={rows} />
      </div>
    </div>
  );
}
