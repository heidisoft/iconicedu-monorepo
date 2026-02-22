import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard | ICONIC Academy',
    template: '%s | ICONIC Academy Dashboard',
  },
  description: 'ICONIC Academy learner dashboard for classes, messages, and progress tracking.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  const account = accountResponse.data ?? null;

  if (!account?.org_id) {
    redirect('/get-started');
  }

  const destination = await resolveOrgDashboardPath(supabase, account.org_id, '/get-started');
  redirect(destination);
}
