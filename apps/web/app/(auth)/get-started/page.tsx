import GetStartedClient from '@iconicedu/web/app/(auth)/get-started/get-started-client';
import GetStartedAuthClient from '@iconicedu/web/app/(auth)/get-started/get-started-auth-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

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
