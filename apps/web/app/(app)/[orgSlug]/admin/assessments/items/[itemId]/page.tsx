import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
import { ItemEditor } from '@iconicedu/web/components/assessments/item-editor';

export const metadata: Metadata = { title: 'Admin · Edit Question' };

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ orgSlug: string; itemId: string }>;
}) {
  const { orgSlug, itemId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const item = await api.getItem(itemId, org.id).catch(() => null);
  if (!item) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Edit Question" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/assessments/items`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Item Bank
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {item.skillName}
              {item.domainName ? ` · ${item.domainName}` : ''}
              {item.grade ? ` · Grade ${item.grade}` : ''}
            </p>
          </div>
        </div>

        <ItemEditor orgId={org.id} orgSlug={orgSlug} item={item} />
      </div>
    </div>
  );
}
