import type { CSSProperties, ReactNode } from 'react';
import { Suspense } from 'react';
import '@iconicedu/ui-web/styles.css';
import { ThemeProvider, Toaster } from '@iconicedu/ui-web';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { PostHogAnalytics } from '@iconicedu/web/components/posthog-analytics';

export const metadata = {
  title: 'ICONIC EDU',
  description: 'Welcome to ICONIC Academy',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          ['--font-sans' as string]:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        } as CSSProperties
      }
    >
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
          <Suspense fallback={null}>
            <PostHogAnalytics />
          </Suspense>
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
