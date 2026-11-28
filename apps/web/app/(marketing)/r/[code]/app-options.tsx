'use client';
import {
  cancelReferralFlow,
  markReferralFlow,
  readReferralFlow,
} from '@iconicedu/web/lib/referrals/referral-exit';
import React, { useEffect, useRef, useState } from 'react';
import { ICONIC_APP_SCHEME } from '@iconicedu/utils';
import { MarketingStoreBadges } from '@iconicedu/ui-web/components/marketing/marketing-store-badges';

export function ReferralAppOptions({ code }: { code: string }) {
  const [copyStatus, setCopyStatus] = useState('');
  const mounted = useRef(false);
  const preserve = useRef(false);
  useEffect(() => {
    mounted.current = true;
    preserve.current = false;
    markReferralFlow(code, 'invitation');
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (
        form instanceof HTMLFormElement &&
        new URL(form.action).pathname === `/r/${code}/continue`
      ) {
        preserve.current = true;
        markReferralFlow(code, 'signup');
      }
    };
    const leave = () => {
      const flow = readReferralFlow();
      if (
        !preserve.current &&
        (!flow || (flow.code === code && flow.phase === 'invitation'))
      )
        cancelReferralFlow(code);
    };
    document.addEventListener('submit', submit, true);
    window.addEventListener('pagehide', leave);
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) leave();
      });
      document.removeEventListener('submit', submit, true);
      window.removeEventListener('pagehide', leave);
    };
  }, [code]);
  return (
    <section aria-labelledby="continue-in-app" className="space-y-4">
      <h2 id="continue-in-app" className="text-xl font-semibold">
        Continue in the app
      </h2>
      <a
        href={`${ICONIC_APP_SCHEME}://r/${code}`}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Open app and continue
      </a>
      <p className="text-sm text-muted-foreground">
        New to the app? Download it below, then return to this invitation and tap “Open
        app and continue”. Your invitation will be ready to accept before signup.
      </p>
      <MarketingStoreBadges layout="inline" size="compact" />
      <details className="rounded-2xl border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Need to enter your invitation manually?
        </summary>
        <p className="mt-3 text-muted-foreground">
          On the app’s welcome screen, tap “Have an invitation?” and paste this code. You
          can also paste the original invitation link.
        </p>
        <code className="my-3 block select-all break-all rounded-xl bg-muted p-3">
          {code}
        </code>
        <button
          type="button"
          className="min-h-11 rounded-xl border px-4 font-semibold"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopyStatus('Invitation code copied.');
            } catch {
              setCopyStatus('Select the code above to copy it.');
            }
          }}
        >
          Copy invitation code
        </button>
        <p aria-live="polite" className="mt-2 text-muted-foreground">
          {copyStatus}
        </p>
      </details>
    </section>
  );
}
