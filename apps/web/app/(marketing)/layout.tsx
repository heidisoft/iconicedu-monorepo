import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { MarketingHeader } from '@iconicedu/ui-web';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
  description:
    'ICONIC Academy helps families find personalized online tutoring for K-12 learners with expert educators, flexible scheduling, and measurable progress.',
  keywords: [
    'online tutoring',
    'K-12 tutoring',
    'personalized learning',
    'math tutor',
    'science tutor',
    'reading support',
    'homework help',
    'ICONIC Academy',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ICONIC Academy',
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Find trusted educators, flexible online sessions, and personalized learning paths built for your child.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ICONIC Academy | Personalized Online Tutoring for K-12',
    description:
      'Personalized online tutoring with expert educators, flexible scheduling, and clear progress tracking.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

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
