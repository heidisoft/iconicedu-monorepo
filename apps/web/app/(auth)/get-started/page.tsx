import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Get Started | ICONIC Academy',
  description: 'Start your ICONIC Academy account setup and complete onboarding.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GetStartedPage() {
  redirect('/i/get-started');
}
