import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { Button } from '@iconicedu/ui-web';
import { ArrowLeft } from 'lucide-react';
import { ItemEditor } from '@iconicedu/web/components/assessments/item-editor';
import { AdminPageShell } from '@iconicedu/web/components/admin/admin-page-layout';

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
    <AdminPageShell title="New Question">
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
          <h1 className="text-2xl font-semibold tracking-tight">New Question</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new question for the item bank. Tag it to a skill so it can be
            assembled into tests.
          </p>
        </div>
      </div>

      <ItemEditor orgId={org.id} orgSlug={orgSlug} />
    </AdminPageShell>
  );
}
