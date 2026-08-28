import type { NextRequest } from 'next/server';
import { refreshSupabaseSession } from '@iconicedu/web/lib/supabase/middleware';

// flag-exempt: maintenance correction to existing authentication session handling
export function middleware(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
