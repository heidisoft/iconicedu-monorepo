import type { Metadata } from 'next';
import GetStartedClient from '@iconicedu/web/app/(auth)/get-started/get-started-client';
import GetStartedAuthClient from '@iconicedu/web/app/(auth)/get-started/get-started-auth-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Get Started | ICONIC Academy',
  description: 'Start your ICONIC Academy account setup and complete onboarding.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GetStartedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <GetStartedAuthClient />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <GetStartedClient />
    </div>
  );
}
