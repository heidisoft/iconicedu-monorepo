import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import EducatorAuthClient from '@iconicedu/web/app/(auth)/login/tutor/educator-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Educator Login | ICONIC Academy',
  description: 'Sign in as an educator on ICONIC Academy to manage classes and student progress.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EducatorPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/d');
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <EducatorAuthClient />
      </div>
    </div>
  );
}
