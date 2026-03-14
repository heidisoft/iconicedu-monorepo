import type { Metadata } from 'next';
import { MarketingHomePage } from '@iconicedu/ui-web';

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

export default function HomePage() {
  return <MarketingHomePage />;
}
