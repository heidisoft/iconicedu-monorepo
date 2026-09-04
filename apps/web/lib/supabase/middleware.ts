import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicWebEnv } from '@iconicedu/web/lib/config/env';

export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = getPublicWebEnv();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.append('Vary', 'Cookie');
      },
    },
  });

  // getUser validates the current access token and refreshes an expired session.
  // The cookie adapter above keeps Server Components and the browser on the same
  // refresh-token generation. Do not add redirects here; route-level auth owns them.
  await supabase.auth.getUser();

  return response;
}
