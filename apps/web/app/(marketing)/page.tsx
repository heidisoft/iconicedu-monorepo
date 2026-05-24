import type { Metadata } from 'next';
import { MarketingHomePage } from '@iconicedu/ui-web';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Personalized Online Tutoring for K-12',
  description:
    'Explore K-12 tutoring with experienced USA and global tutors, full-curriculum support, state standards support where applicable, and advanced learner enrichment.',
  openGraph: {
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Explore K-12 tutoring with experienced USA and global tutors, full-curriculum support, state standards support where applicable, and advanced learner enrichment.',
  },
  twitter: {
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Explore K-12 tutoring with experienced USA and global tutors, full-curriculum support, state standards support where applicable, and advanced learner enrichment.',
  },
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const loginHref = await resolveDefaultOrgLoginPath(supabase);

  return <MarketingHomePage loginHref={loginHref} />;
}
