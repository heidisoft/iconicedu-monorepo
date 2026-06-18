import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
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
      <DashboardHeader title="New Test" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/tests`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Tests
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Test</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create a static or adaptive test. You can add questions after saving.
            </p>
          </div>
        </div>

        <TestForm orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
