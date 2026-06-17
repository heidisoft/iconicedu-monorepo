import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { DashboardHeader } from '@iconicedu/ui-web';
import { ItemEditor } from '@iconicedu/web/components/assessments/item-editor';

export const metadata: Metadata = { title: 'Admin · New Question' };

export default async function NewItemPage({
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
        title="New Question"
        description="Create a new question for the item bank."
      />
      <div className="flex flex-1 flex-col p-6">
        <ItemEditor orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
