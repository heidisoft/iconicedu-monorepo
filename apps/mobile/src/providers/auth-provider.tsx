import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase/client';
import { activateAccount } from '@/lib/api/queries';

// Explicit path is required — bare `iconicedu://` does not match Supabase's `iconicedu://**` glob.
// Ensure `iconicedu://auth-callback` (or `iconicedu://**`) is in
// Supabase → Auth → URL Configuration → Redirect URLs.
const GOOGLE_REDIRECT_URI = 'iconicedu://auth-callback';

// Required for iOS Safari View Controller / Android Chrome Custom Tab to complete the session
WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Check that the signed-in user has an account row with an org assigned. */
async function checkOrgAssignment(userId: string): Promise<string | null> {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('org_id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  // If the query itself errors (e.g. RLS blocked before session propagated),
  // do not sign the user out — let them through and surface data errors later.
  if (error) return null;

  // Row found but org not assigned — genuine configuration problem.
  if (account && !account.org_id) {
    await supabase.auth.signOut();
    return 'Your account is not linked to an organisation. Please contact your administrator.';
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  /** Send a sign-in OTP. Only works for accounts that already exist. */
  const signInWithOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('signups not allowed') ||
        msg.includes('user not found') ||
        error.status === 422 ||
        error.status === 400
      ) {
        return { error: 'No account found with this email address. Visit www.iconicedu.lk to sign up before logging in to the app.' };
      }
      return { error: error.message };
    }

    return { error: null };
  }, []);

  /** Verify OTP code and confirm org membership before allowing access. */
  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) return { error: error.message };

    // Explicitly commit the session so the SecureStore adapter has the tokens
    // persisted before the subsequent accounts query (avoids RLS race condition).
    if (data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    if (data.user) {
      const orgError = await checkOrgAssignment(data.user.id);
      if (orgError) return { error: orgError };
    }

    // Mark account as active, mirroring web's /api/accounts/activate step.
    await activateAccount();

    return { error: null };
  }, []);

  /**
   * Sign in with Google via Supabase OAuth (implicit flow).
   * Opens Safari View Controller (iOS) / Chrome Custom Tab (Android).
   * Supabase returns access_token + refresh_token in the URL hash.
   */
  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_REDIRECT_URI,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return { error: error?.message ?? 'Could not start Google sign-in.' };
    }

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URI);

    if (browserResult.type !== 'success') {
      return { error: null };
    }

    // Implicit flow: tokens arrive in the URL hash fragment
    const url = browserResult.url;
    const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) {
      return { error: 'Sign-in failed. No token received.' };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
    });

    if (sessionError) return { error: sessionError.message };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const orgError = await checkOrgAssignment(user.id);
      if (orgError) return { error: orgError };
    }

    // Mark account as active, mirroring web's /api/accounts/activate step.
    await activateAccount();

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithOtp,
      verifyOtp,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signInWithOtp, verifyOtp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
