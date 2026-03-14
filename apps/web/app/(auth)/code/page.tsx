import type { Metadata } from 'next';

import CodeEntryClient from './code-entry-client';

export const metadata: Metadata = {
  title: 'Enter Code | ICONIC Academy',
  description: 'Enter your verification code to continue signing in.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OTPPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <CodeEntryClient />
      </div>
    </div>
  );
}
