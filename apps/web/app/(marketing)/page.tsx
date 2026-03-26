import type { Metadata } from 'next';
import { MarketingHomePage } from '@iconicedu/ui-web';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Personalized Online Tutoring for K-12',
  description:
    'Explore personalized online tutoring, flexible scheduling, and expert educators for K-12 learners.',
  openGraph: {
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Explore personalized online tutoring, flexible scheduling, and expert educators for K-12 learners.',
  },
  twitter: {
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Explore personalized online tutoring, flexible scheduling, and expert educators for K-12 learners.',
  },
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const loginHref = await resolveDefaultOrgLoginPath(supabase);

  return <MarketingHomePage loginHref={loginHref} />;
}
