import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Badge, Button } from '@iconicedu/ui-web';
import { ArrowLeft, Zap, LayoutList, Pencil } from 'lucide-react';
import { TestBuilder } from '@iconicedu/web/components/assessments/test-builder';

export const metadata: Metadata = { title: 'Admin · Test Builder' };

export default async function TestBuilderPage({
  params,
}: {
  params: Promise<{ orgSlug: string; testId: string }>;
}) {
  const { orgSlug, testId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const test = await api.getTest(testId, org.id).catch(() => null);
  if (!test) notFound();

  const ModeIcon = test.mode === 'adaptive' ? Zap : LayoutList;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={test.title} />
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">{test.title}</h1>
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <Pencil className="h-3 w-3" /> Editing
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {test.mode === 'adaptive'
                  ? 'Configure skill pools and adaptive rules'
                  : 'Manage sections and questions'}
              </p>
            </div>
            <Badge
              variant={test.mode === 'adaptive' ? 'default' : 'secondary'}
              className="flex items-center gap-1.5 flex-shrink-0"
            >
              <ModeIcon className="h-3 w-3" />
              {test.mode === 'adaptive' ? 'Adaptive' : 'Standard'}
            </Badge>
          </div>
        </div>

        <TestBuilder test={test} orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
