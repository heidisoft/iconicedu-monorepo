import type { Metadata } from 'next';
import { Suspense } from 'react';

import CodeEntryClient from './code-entry-client';
import { enableWebTurnstile } from '@iconicedu/web/flags';
import { resolveTurnstileSiteKey } from '@iconicedu/web/lib/auth/turnstile-config';

export const metadata: Metadata = {
  title: 'Enter Code | ICONIC Academy',
  description: 'Enter your verification code to continue signing in.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OTPPage() {
  const showTurnstile = await enableWebTurnstile();
  const turnstileSiteKey = resolveTurnstileSiteKey(showTurnstile);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={null}>
          <CodeEntryClient turnstileSiteKey={turnstileSiteKey} />
        </Suspense>
      </div>
    </div>
  );
}
