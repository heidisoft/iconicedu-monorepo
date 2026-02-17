'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

type SupportedOtpType = 'magiclink' | 'invite' | 'signup';

function resolveOtpType(value?: string | null): SupportedOtpType {
  if (value === 'magiclink' || value === 'invite' || value === 'signup') {
    return value;
  }
  if (value === 'invitation') {
    return 'invite';
  }
  return 'invite';
}

export default function CallbackPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = resolveOtpType(searchParams.get('type'));
    const isEducatorFlow = searchParams.get('educator') === '1';

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash,
    );
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    const activateAccount = async () => {
      try {
        const response = await fetch('/api/accounts/activate', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (!response.ok) {
          console.error('Failed to mark account as active', await response.text());
        }
      } catch (error) {
        console.error('Failed to activate account after auth callback', error);
      }
    };

    const finish = async () => {
      if (isEducatorFlow) {
        document.cookie =
          'profile_kind_override=educator; path=/; max-age=60; sameSite=Lax;';
      }
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        await activateAccount();
        router.replace('/d');
        return;
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        await activateAccount();
        router.replace('/d');
        return;
      }

      if (token) {
        await supabase.auth.verifyOtp({
          token_hash: token,
          type,
        });
        await activateAccount();

        router.replace('/d');
      }
    };

    void finish();
  }, [router, supabase]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-sm text-muted-foreground">Logging you in…</p>
    </div>
  );
}
