import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import OrgGetStartedClient from '@iconicedu/web/app/(auth)/[orgSlug]/get-started/org-get-started-client';
import { MobileAppPrompt } from '@iconicedu/web/app/(auth)/shared/mobile-app-prompt';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { enableMobileAppleSignIn, enableMobileGoogleSignIn } from '@iconicedu/web/flags';
import { isMobileOrTablet } from '@iconicedu/web/lib/mobile/detect-mobile';

export const metadata: Metadata = {
  title: 'Get Started | ICONIC Academy',
  description:
    'Create your ICONIC Academy account for your organization and complete onboarding.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrgGetStartedPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { orgSlug } = await params;
  const { email: initialEmail } = await searchParams;
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
    redirect(
      `/auth/callback?resume=1&org=${org.slug}&intent=get-started&source=self-signup`,
    );
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
        <OrgGetStartedClient
          orgSlug={org.slug}
          orgName={org.name}
          initialEmail={initialEmail}
          enableGoogleSignIn={showGoogleSignIn}
          enableAppleSignIn={showAppleSignIn}
        />
      </div>
    </div>
  );
}
