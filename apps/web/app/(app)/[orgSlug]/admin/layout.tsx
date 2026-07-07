import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  const adminContext = await requireAdminOrgContext(org.id);

  if (!adminContext.ok) {
    redirect(`/${orgSlug}`);
  }

  return children;
}
