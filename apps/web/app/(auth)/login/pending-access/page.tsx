import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Pending | ICONIC Academy',
  description:
    'Your ICONIC Academy access request is pending review. We will notify you once it is approved.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PendingAccessPage() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-4xl border border-border/70 bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Access request received</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Thanks for getting started. Your account is pending review before full access is
          enabled.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If this is urgent, contact support for assistance.
        </p>
      </div>
    </div>
  );
}
