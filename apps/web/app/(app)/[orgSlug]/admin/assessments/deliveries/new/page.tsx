import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader } from '@iconicedu/ui-web';
import { DeliveryForm } from '@iconicedu/web/components/assessments/delivery-form';

export const metadata: Metadata = { title: 'Admin · New Delivery' };

export default async function NewDeliveryPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const tests = await api.listTests(org.id).catch(() => []);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="New Delivery"
        description="Assign a test to students or generate a public link."
      />
      <div className="flex flex-1 flex-col p-6">
        <DeliveryForm orgId={org.id} orgSlug={orgSlug} tests={tests} />
      </div>
    </div>
  );
}
