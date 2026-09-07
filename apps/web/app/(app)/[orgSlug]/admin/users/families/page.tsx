import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { FamiliesDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/families/families-dashboard';
import { AdminPageShell } from '@iconicedu/web/components/admin/admin-page-layout';

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

  return (
    <AdminPageShell title="Manage families">
      <FamiliesDashboard orgSlug={orgSlug} />
    </AdminPageShell>
  );
}
