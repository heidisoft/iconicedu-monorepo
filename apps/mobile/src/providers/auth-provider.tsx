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
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { activateAccount, fetchUserAccount } from '@/lib/api/queries';
import {
  getStoredPushToken,
  revokePushToken,
  clearUserNotificationState,
} from '@/lib/notifications/push-token';
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
const AUTH_REDIRECT_URI = 'iconicedu://auth-callback';
const AUTH_TIMEOUT_MS = 12_000;

// Required for iOS Safari View Controller / Android Chrome Custom Tab to complete the session
WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sessionExpiryMessage: string | null;
  signInWithOtp: (
    email: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null }>;
  signUpWithOtp: (
    email: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setOnboardingCompletionStatus: (isComplete: boolean | null) => void;
  clearSessionExpiryMessage: () => void;
};

const AuthContext = createContext<AuthState | null>(null);
type OAuthProvider = 'apple' | 'google';

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

type UserAccount = {
  org_id?: string | null;
};

/** Check that the signed-in user has an account row with an org assigned. */
async function checkOrgAssignment(): Promise<string | null> {
  const account = (await withTimeout(
    fetchUserAccount(),
    'Account lookup timed out. Please check your connection and try again.',
  )) as UserAccount | null;

  if (!account) {
    await supabase.auth.signOut();
    return 'No ICONIC Academy account is linked to this sign-in. Please register first or contact your administrator.';
  }

  if (!account.org_id) {
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
  const queryClient = useQueryClient();
  const onboardingCompleteRef = useRef<boolean | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  const setOnboardingCompletionStatus = useCallback((isComplete: boolean | null) => {
    onboardingCompleteRef.current = isComplete;
  }, []);

  const clearSessionExpiryMessage = useCallback(() => {
    setSessionExpiryMessage(null);
  }, []);

  const clearLocalSession = useCallback(async () => {
    setSession(null);
    onboardingCompleteRef.current = null;
    backgroundedAtRef.current = null;
    analytics.reset();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      reportObservedError({
        error,
        source: 'mobile.auth.clear_local_session',
        message: 'Failed to clear local Supabase session',
      });
    }
  }, [analytics]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const {
          data: { session: s },
        } = await withTimeout(
          supabase.auth.getSession(),
          'Session check timed out. Please try again.',
        );

        if (!s) {
          if (!cancelled) {
            setSession(null);
            setLoading(false);
          }
          return;
        }

        const {
          data: { user },
          error,
        } = await withTimeout(
          supabase.auth.getUser(),
          'User lookup timed out. Please try again.',
        );

        if (error || !user) {
          if (!cancelled) {
            await clearLocalSession();
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setSession({ ...s, user });
          analytics.identify(user.id, { email: user.email });
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          reportObservedError({
            error,
            source: 'mobile.auth.bootstrap_session',
            message: 'Failed to bootstrap mobile auth session',
          });
          await clearLocalSession();
          setLoading(false);
        }
      }
    }

    void bootstrapSession();

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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [analytics, clearLocalSession]);

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
  const signInWithOtp = useCallback(async (email: string, captchaToken?: string) => {
    setSessionExpiryMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        ...(captchaToken ? { captchaToken } : {}),
      },
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

  const signUpWithOtp = useCallback(async (email: string, captchaToken?: string) => {
    setSessionExpiryMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    return { error: error?.message ?? null };
  }, []);

  /** Verify OTP code and confirm org membership before allowing access. */
  const verifyOtpCode = useCallback(
    async (email: string, token: string, options: { requireLinkedAccount: boolean }) => {
      try {
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

        if (options.requireLinkedAccount && data.user) {
          const orgError = await checkOrgAssignment();
          if (orgError) return { error: orgError };
        }

        if (options.requireLinkedAccount) {
          // Mark account as active, mirroring web's /api/accounts/activate step.
          await withTimeout(
            activateAccount(),
            'Account activation timed out. Please check your connection and try again.',
          );
        }

        return { error: null };
      } catch (error) {
        reportObservedError({
          error,
          source: 'mobile.auth.verify_otp',
          message: 'Failed to complete OTP sign-in',
        });
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Could not complete sign-in. Please try again.',
        };
      }
    },
    [],
  );

  const verifyOtp = useCallback(
    (email: string, token: string) =>
      verifyOtpCode(email, token, { requireLinkedAccount: true }),
    [verifyOtpCode],
  );

  const verifySignupOtp = useCallback(
    (email: string, token: string) =>
      verifyOtpCode(email, token, { requireLinkedAccount: false }),
    [verifyOtpCode],
  );

  /**
   * Sign in with a Supabase OAuth provider (implicit flow).
   * Opens Safari View Controller (iOS) / Chrome Custom Tab (Android).
   * Supabase returns access_token + refresh_token in the URL hash.
   */
  const signInWithOAuthProvider = useCallback(
    async (provider: OAuthProvider, options: { requireLinkedAccount: boolean }) => {
      try {
        setSessionExpiryMessage(null);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: AUTH_REDIRECT_URI,
            skipBrowserRedirect: true,
          },
        });

        if (error || !data.url) {
          return { error: error?.message ?? `Could not start ${provider} sign-in.` };
        }

        const browserResult = await withTimeout(
          WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URI),
          'Sign-in timed out. Please check your connection and try again.',
        );

        if (browserResult.type !== 'success') {
          return { error: null };
        }

        // Implicit flow: tokens arrive in the URL hash fragment
        const url = browserResult.url;
        const fragment = url.includes('#')
          ? url.split('#')[1]
          : (url.split('?')[1] ?? '');
        const params = new URLSearchParams(fragment);
        const authError = params.get('error_description') ?? params.get('error');
        if (authError) {
          return { error: authError };
        }

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
        if (options.requireLinkedAccount && user) {
          const orgError = await checkOrgAssignment();
          if (orgError) return { error: orgError };
        }

        if (options.requireLinkedAccount) {
          // Mark account as active, mirroring web's /api/accounts/activate step.
          await withTimeout(
            activateAccount(),
            'Account activation timed out. Please check your connection and try again.',
          );
        }

        return { error: null };
      } catch (error) {
        reportObservedError({
          error,
          source: `mobile.auth.oauth.${provider}`,
          message: `Failed to complete ${provider} sign-in`,
        });
        return {
          error:
            error instanceof Error
              ? error.message
              : `Could not complete ${provider} sign-in. Please try again.`,
        };
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(
    () => signInWithOAuthProvider('google', { requireLinkedAccount: false }),
    [signInWithOAuthProvider],
  );

  const signInWithApple = useCallback(
    () => signInWithOAuthProvider('apple', { requireLinkedAccount: false }),
    [signInWithOAuthProvider],
  );

  const signOut = useCallback(async () => {
    setSessionExpiryMessage(null);
    onboardingCompleteRef.current = null;
    backgroundedAtRef.current = null;
    analytics.capture(AnalyticsEvent.SIGNED_OUT);
    analytics.reset();
    try {
      const token = await getStoredPushToken();
      if (token) await revokePushToken(token);
    } catch {
      // Token revocation is best-effort; never block sign-out
    }
    await clearUserNotificationState();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [analytics, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      sessionExpiryMessage,
      signInWithOtp,
      signUpWithOtp,
      verifyOtp,
      verifySignupOtp,
      signInWithGoogle,
      signInWithApple,
      signOut,
      setOnboardingCompletionStatus,
      clearSessionExpiryMessage,
    }),
    [
      session,
      loading,
      sessionExpiryMessage,
      signInWithOtp,
      signUpWithOtp,
      verifyOtp,
      verifySignupOtp,
      signInWithGoogle,
      signInWithApple,
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
