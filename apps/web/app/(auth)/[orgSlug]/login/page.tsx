import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import OrgLoginClient from '@iconicedu/web/app/(auth)/[orgSlug]/login/org-login-client';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';

export const metadata: Metadata = {
  title: 'Organization Login | ICONIC Academy',
  description: 'Sign in to your organization workspace on ICONIC Academy.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrgLoginPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const serviceSupabase = createSupabaseServiceClient();
  const org = await buildOrgBySlug(serviceSupabase, orgSlug);

  if (!org) {
    notFound();
  }

  const sessionSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();

  if (user) {
    const accountResponse = await getAccountByAuthUserId(serviceSupabase, user.id);
    if (accountResponse.data?.org_id) {
      redirect(await resolveOrgDashboardPath(serviceSupabase, accountResponse.data.org_id));
    }
    redirect(`/${org.slug}/get-started`);
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OrgLoginClient orgSlug={org.slug} orgName={org.name} />
      </div>
    </div>
  );
}
