import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { DashboardHeader } from '@iconicedu/ui-web';
import { TestForm } from '@iconicedu/web/components/assessments/test-form';

export const metadata: Metadata = { title: 'Admin · New Test' };

export default async function NewTestPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="New Test"
        description="Create a new static or adaptive test."
      />
      <div className="flex flex-1 flex-col p-6">
        <TestForm orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
