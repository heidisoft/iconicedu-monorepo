import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { OrgGeneralSettingsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/general/org-general-settings-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Organization Settings',
  description: 'Organization-wide settings, including AI-assisted messaging.',
};

export default async function AdminGeneralSettingsPage({
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
    <AdminPageShell title="Organization Settings">
      <AdminPageHeading
        title="Organization Settings"
        description="Settings that apply across this organization."
      />
      <OrgGeneralSettingsDashboard orgId={org.id} />
    </AdminPageShell>
  );
}
