import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginClient from '@iconicedu/web/app/(auth)/login/login-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { hasAnyActiveOrgs } from '@iconicedu/web/lib/org/has-orgs';

export const metadata: Metadata = {
  title: 'Login | ICONIC Academy',
  description: 'Sign in to your ICONIC Academy account to access your dashboard and learning tools.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    if (!(await hasAnyActiveOrgs(supabase))) {
      redirect('/get-started');
    }
    const accountResponse = await getAccountByAuthUserId(supabase, data.user.id);
    if (accountResponse.data?.org_id) {
      redirect(await resolveOrgDashboardPath(supabase, accountResponse.data.org_id));
    }
    redirect('/auth/callback?resume=1');
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginClient />
      </div>
    </div>
  );
}
