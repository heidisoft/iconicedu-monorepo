import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicWebEnv } from '@iconicedu/web/lib/config/env';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type CreateSupabaseServerClientOptions = {
  cookieStore?: CookieStore;
  allowCookieModification?: boolean;
};

export const createSupabaseServerClient = async ({
  cookieStore,
  allowCookieModification = false,
}: CreateSupabaseServerClientOptions = {}) => {
  const { supabaseUrl, supabasePublishableKey } = getPublicWebEnv();

  const resolvedCookieStore = cookieStore ?? (await cookies());

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return resolvedCookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!allowCookieModification || !('set' in resolvedCookieStore)) {
          return;
        }
        cookiesToSet.forEach(({ name, value, options }) => {
          resolvedCookieStore.set({ name, value, ...options });
        });
      },
    },
  });
};
