import type { Metadata } from 'next';
import { OTPForm } from '@iconicedu/ui-web';

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
        <OTPForm />
      </div>
    </div>
  );
}
