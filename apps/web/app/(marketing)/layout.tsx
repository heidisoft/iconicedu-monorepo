import type { ReactNode } from 'react';
import { MarketingHeader } from '@iconicedu/ui-web';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export { metadata } from './layout.metadata';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <MarketingHeader isAuthenticated={Boolean(user)} />
      <main>{children}</main>
    </>
  );
}
