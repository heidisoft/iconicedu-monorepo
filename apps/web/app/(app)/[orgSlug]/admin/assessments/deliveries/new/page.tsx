import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
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
      <DashboardHeader title="New Delivery" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/deliveries`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> All deliveries
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Delivery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assign a test to students or generate a public shareable link.
            </p>
          </div>
        </div>

        <DeliveryForm orgId={org.id} orgSlug={orgSlug} tests={tests} />
      </div>
    </div>
  );
}
