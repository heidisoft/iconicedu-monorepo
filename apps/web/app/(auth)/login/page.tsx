import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Get Started | ICONIC Academy',
  description: 'Admin-first organization setup entry for ICONIC Academy.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  redirect('/get-started');
}
