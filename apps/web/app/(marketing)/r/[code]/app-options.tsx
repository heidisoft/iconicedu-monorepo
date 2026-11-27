'use client';
import React, { useState } from 'react';
import {
  ICONIC_IOS_STORE_URL,
  ICONIC_ANDROID_STORE_URL,
  ICONIC_APP_SCHEME,
} from '@iconicedu/utils';

export function ReferralAppOptions({ code }: { code: string }) {
  const [copyStatus, setCopyStatus] = useState('');
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
      <div className="flex flex-wrap gap-3">
        <a
          href={ICONIC_IOS_STORE_URL}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border px-4 py-3 font-semibold"
        >
          Download for iPhone
        </a>
        <a
          href={ICONIC_ANDROID_STORE_URL}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border px-4 py-3 font-semibold"
        >
          Download for Android
        </a>
      </div>
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
