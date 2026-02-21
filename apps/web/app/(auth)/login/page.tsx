import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginClient from '@iconicedu/web/app/(auth)/login/login-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Login | ICONIC Academy',
  description: 'Sign in to your ICONIC Academy account to access your dashboard and learning tools.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/d');
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginClient />
      </div>
    </div>
  );
}
