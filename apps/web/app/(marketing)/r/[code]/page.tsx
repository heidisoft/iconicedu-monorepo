import Link from 'next/link';
import { getReferralEntryState } from '@iconicedu/web/lib/referrals/referral-entry-state';
import { ReferralAppOptions } from './app-options';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Users, Check, ArrowRight } from 'lucide-react';
import { enableParentReferrals } from '@iconicedu/web/flags';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import type { ParentReferralLanding } from '@iconicedu/shared-types';
import { isParentReferralCode } from '@iconicedu/web/lib/referrals/referral-cookie';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'A personal invitation | ICONIC Academy',
  description:
    'Join other families at ICONIC Academy. Create a parent account to explore classes, manage your children’s schedules, and stay connected with the academy.',
  robots: { index: false, follow: false },
};
export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!(await enableParentReferrals())) notFound();
  const { code } = await params;
  if (!isParentReferralCode(code)) notFound();
  const entryState = await getReferralEntryState();
  if (entryState !== 'guest')
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6 py-12">
        <h1 className="text-3xl font-bold">
          {entryState === 'signed_in'
            ? 'Invitations are for new parents'
            : 'Unable to check your account'}
        </h1>
        <p className="text-muted-foreground">
          {entryState === 'signed_in'
            ? 'You’re already signed in. A referral cannot be applied to your existing account, including your own invitation.'
            : 'Please try again before accepting this invitation.'}
        </p>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Back to ICONIC Academy
        </Link>
      </main>
    );
  let invitation: ParentReferralLanding;
  try {
    invitation = await createPublicApiClient().get<ParentReferralLanding>(
      `/referrals/links/${code}`,
    );
  } catch {
    notFound();
  }
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-7 px-6 py-12">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Users size={32} aria-hidden />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">
        A personal invitation
      </p>
      <h1 className="text-4xl font-bold tracking-tight">
        Join families learning with ICONIC Academy.
      </h1>
      <p className="text-lg text-muted-foreground">
        {invitation.referrerName} invited you to ICONIC Academy.
      </p>
      <div className="rounded-3xl border bg-card p-6">
        <h2 className="font-semibold">Support your child’s next step</h2>
        <p className="mt-2 text-muted-foreground">
          Join other parents supporting their children’s learning. Create a parent account
          to explore classes and keep your family’s learning organised in one place.
        </p>
      </div>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {[
          'Explore classes for your child.',
          'Manage your children’s profiles and see their upcoming sessions.',
          'Stay connected with academy updates and messages.',
        ].map((item) => (
          <li key={item} className="flex gap-3">
            <Check size={18} aria-hidden className="shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
      <ReferralAppOptions code={code} />
      <form action={`/r/${code}/continue`} method="post">
        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border px-5 py-3 font-semibold"
        >
          Continue on the web <ArrowRight size={18} aria-hidden />
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Prefer to use your browser? Create your parent account here without installing an
        app.
      </p>
      <p className="text-xs text-muted-foreground">
        As a thank-you for introducing your family, {invitation.referrerName} can receive{' '}
        {invitation.rewardLabel} after our team confirms your signup. Your invitation is
        linked automatically, with no referral code to enter.
      </p>
    </main>
  );
}
