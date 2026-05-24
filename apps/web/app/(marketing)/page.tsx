import type { Metadata } from 'next';
import { MarketingHomePage } from '@iconicedu/ui-web';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Personalized K-12 Tutoring and Enrichment',
  description:
    'ICONIC Academy helps K-12 students succeed in school and beyond with experienced tutors, curriculum-aligned support, and affordable enrichment programs.',
  openGraph: {
    title: 'ICONIC Academy | Personalized K-12 Tutoring and Enrichment',
    description:
      'ICONIC Academy helps K-12 students succeed in school and beyond with experienced tutors, curriculum-aligned support, and affordable enrichment programs.',
  },
  twitter: {
    title: 'ICONIC Academy | Personalized K-12 Tutoring and Enrichment',
    description:
      'ICONIC Academy helps K-12 students succeed in school and beyond with experienced tutors, curriculum-aligned support, and affordable enrichment programs.',
  },
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const loginHref = await resolveDefaultOrgLoginPath(supabase);

  return <MarketingHomePage loginHref={loginHref} />;
}
