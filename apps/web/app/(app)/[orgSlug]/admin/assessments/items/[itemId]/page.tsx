import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader } from '@iconicedu/ui-web';
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
      <DashboardHeader title="Edit Question" description={item.title} />
      <div className="flex flex-1 flex-col p-6">
        <ItemEditor orgId={org.id} orgSlug={orgSlug} item={item} />
      </div>
    </div>
  );
}
