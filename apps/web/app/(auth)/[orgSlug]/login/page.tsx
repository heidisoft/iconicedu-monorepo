import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import OrgLoginClient from '@iconicedu/web/app/(auth)/[orgSlug]/login/org-login-client';
import { MobileAppPrompt } from '@iconicedu/web/app/(auth)/shared/mobile-app-prompt';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { resolveOrgLoginReason } from '@iconicedu/web/app/(auth)/[orgSlug]/login/login-reason';
import { enableMobileAppleSignIn, enableMobileGoogleSignIn } from '@iconicedu/web/flags';
import { isMobileOrTablet } from '@iconicedu/web/lib/mobile/detect-mobile';

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
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ reason?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
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
    const accountResponse = await getAccountByAuthUserIdInOrg(
      serviceSupabase,
      user.id,
      org.id,
    );
    if (accountResponse.data?.org_id) {
      redirect(
        await resolveOrgDashboardPath(serviceSupabase, accountResponse.data.org_id),
      );
    }
    redirect(`/${org.slug}/get-started`);
  }

  const isMobile = isMobileOrTablet(await headers());

  const [showGoogleSignIn, showAppleSignIn] = await Promise.all([
    enableMobileGoogleSignIn(),
    enableMobileAppleSignIn(),
  ]);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <MobileAppPrompt defaultVisible={isMobile} />
      <div className="w-full max-w-sm">
        <OrgLoginClient
          orgSlug={org.slug}
          orgName={org.name}
          loginReason={resolveOrgLoginReason(resolvedSearchParams?.reason)}
          enableGoogleSignIn={showGoogleSignIn}
          enableAppleSignIn={showAppleSignIn}
        />
      </div>
    </div>
  );
}
