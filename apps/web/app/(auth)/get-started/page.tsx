import { redirect } from 'next/navigation';

import GetStartedClient from '@iconicedu/web/app/(auth)/get-started/get-started-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export default async function GetStartedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { count, error } = await supabase
    .from('orgs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    redirect('/auth/callback?resume=1');
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <GetStartedClient />
    </div>
  );
}
