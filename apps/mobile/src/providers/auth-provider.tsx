import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { type Session, type User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase/client';
import { activateAccount } from '@/lib/api/queries';
import { getExpoPushToken, revokePushToken } from '@/lib/notifications/push-token';
import { useAnalytics } from '@/providers/analytics-provider';
import {
  AnalyticsEvent,
  INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS,
  markLastActiveAt,
  reportObservedError,
  shouldRequireReauthOnReturn,
} from '@iconicedu/utils';

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
  sessionExpiryMessage: string | null;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setOnboardingCompletionStatus: (isComplete: boolean | null) => void;
  clearSessionExpiryMessage: () => void;
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
  const [sessionExpiryMessage, setSessionExpiryMessage] = useState<string | null>(null);
  const analytics = useAnalytics();
  const onboardingCompleteRef = useRef<boolean | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  const setOnboardingCompletionStatus = useCallback((isComplete: boolean | null) => {
    onboardingCompleteRef.current = isComplete;
  }, []);

  const clearSessionExpiryMessage = useCallback(() => {
    setSessionExpiryMessage(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        analytics.identify(s.user.id, { email: s.user.email });
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        analytics.identify(s.user.id, { email: s.user.email });
      } else {
        onboardingCompleteRef.current = null;
        backgroundedAtRef.current = null;
        analytics.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [analytics]);

  const signOutForExpiredIncompleteOnboarding = useCallback(async () => {
    analytics.capture(AnalyticsEvent.INCOMPLETE_ONBOARDING_REAUTH_TRIGGERED, {
      source: 'mobile-appstate-return',
    });
    setSessionExpiryMessage(
      'Your session expired because onboarding was not completed. Please log in again to continue setup.',
    );
    try {
      analytics.capture(AnalyticsEvent.SIGNED_OUT, {
        reason: 'incomplete-onboarding-expired',
      });
      analytics.reset();
      await supabase.auth.signOut();
    } catch (error) {
      analytics.capture(AnalyticsEvent.INCOMPLETE_ONBOARDING_REAUTH_FAILED, {
        source: 'mobile-appstate-return',
        stage: 'sign_out',
      });
      reportObservedError({
        error,
        source: 'mobile.auth.incomplete_onboarding_reauth.sign_out',
        message: 'Failed to sign out during incomplete onboarding reauth',
        context: {
          userId: session?.user.id ?? null,
        },
      });
    }
  }, [analytics, session?.user.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = previousAppState.current;
      previousAppState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = markLastActiveAt();
        return;
      }

      if (nextState !== 'active' || previousState === 'active' || !session) {
        return;
      }

      const onboardingComplete = onboardingCompleteRef.current;
      if (onboardingComplete == null) {
        analytics.capture(AnalyticsEvent.INCOMPLETE_ONBOARDING_STATUS_UNKNOWN, {
          source: 'mobile-appstate-return',
        });
        return;
      }

      if (
        shouldRequireReauthOnReturn({
          isOnboardingComplete: onboardingComplete,
          lastActiveAt: backgroundedAtRef.current,
          now: Date.now(),
          reauthAfterMs: INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS,
        })
      ) {
        void signOutForExpiredIncompleteOnboarding();
        return;
      }

      backgroundedAtRef.current = null;
    });

    return () => subscription.remove();
  }, [analytics, session, signOutForExpiredIncompleteOnboarding]);

  /** Send a sign-in OTP. Only works for accounts that already exist. */
  const signInWithOtp = useCallback(async (email: string) => {
    setSessionExpiryMessage(null);
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
        return {
          error:
            'No account found with this email address. Visit www.iconicedu.com to sign up before logging in to the app.',
        };
      }
      return { error: error.message };
    }

    return { error: null };
  }, []);

  /** Verify OTP code and confirm org membership before allowing access. */
  const verifyOtp = useCallback(async (email: string, token: string) => {
    setSessionExpiryMessage(null);
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
    setSessionExpiryMessage(null);
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

    const browserResult = await WebBrowser.openAuthSessionAsync(
      data.url,
      GOOGLE_REDIRECT_URI,
    );

    if (browserResult.type !== 'success') {
      return { error: null };
    }

    // Implicit flow: tokens arrive in the URL hash fragment
    const url = browserResult.url;
    const fragment = url.includes('#') ? url.split('#')[1] : (url.split('?')[1] ?? '');
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const orgError = await checkOrgAssignment(user.id);
      if (orgError) return { error: orgError };
    }

    // Mark account as active, mirroring web's /api/accounts/activate step.
    await activateAccount();

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setSessionExpiryMessage(null);
    onboardingCompleteRef.current = null;
    backgroundedAtRef.current = null;
    analytics.capture(AnalyticsEvent.SIGNED_OUT);
    analytics.reset();
    try {
      const token = await getExpoPushToken({ requestPermissions: false });
      if (token) await revokePushToken(token);
    } catch {
      // Token revocation is best-effort; never block sign-out
    }
    await supabase.auth.signOut();
  }, [analytics]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      sessionExpiryMessage,
      signInWithOtp,
      verifyOtp,
      signInWithGoogle,
      signOut,
      setOnboardingCompletionStatus,
      clearSessionExpiryMessage,
    }),
    [
      session,
      loading,
      sessionExpiryMessage,
      signInWithOtp,
      verifyOtp,
      signInWithGoogle,
      signOut,
      setOnboardingCompletionStatus,
      clearSessionExpiryMessage,
    ],
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
