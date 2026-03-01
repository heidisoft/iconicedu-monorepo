import React from 'react';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PostHogProvider, PostHogUserIdentifier } from '@/providers/posthog-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <PostHogProvider>
          <AuthProvider>
            <PostHogUserIdentifier />
            {children}
          </AuthProvider>
        </PostHogProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
