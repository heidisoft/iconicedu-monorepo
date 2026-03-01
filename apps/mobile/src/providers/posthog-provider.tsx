import React, { useEffect } from 'react';
import PostHog, { PostHogProvider as PHProvider } from 'posthog-react-native';
import { useAuth } from '@/providers/auth-provider';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ?? 'https://us.i.posthog.com';

/**
 * Module-level singleton — created once if the key is available.
 * Using a singleton avoids the usePostHog()-outside-provider error and
 * matches the PostHog React Native docs recommendation.
 */
export const posthogClient: PostHog | null = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST })
  : null;

/**
 * Identifies (or resets) the PostHog user when auth state changes.
 * Uses the singleton directly — safe to render anywhere in the tree.
 */
export function PostHogUserIdentifier() {
  const { user } = useAuth();

  useEffect(() => {
    if (!posthogClient) return;
    if (user) {
      posthogClient.identify(user.id, { email: user.email ?? null });
    } else {
      posthogClient.reset();
    }
  }, [user]);

  return null;
}

/**
 * Wraps the app with the PostHog React context (enables usePostHog /
 * useFeatureFlag hooks elsewhere). Falls back to a plain wrapper when
 * the key is not configured.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!posthogClient) {
    return <>{children}</>;
  }

  return <PHProvider client={posthogClient}>{children}</PHProvider>;
}
