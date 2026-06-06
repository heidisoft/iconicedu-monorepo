'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { SiteLogoFull } from '@iconicedu/ui-web/components/branding/site-logo-full';
import { MarketingStoreBadges } from '@iconicedu/ui-web/components/marketing/marketing-store-badges';
import { cn } from '@iconicedu/ui-web/lib/utils';

const SESSION_KEY = 'auth_mobile_app_prompt_dismissed';

const benefits = [
  'Push notifications for messages & updates',
  'Fast, native experience on your device',
  'Offline access to schedules & content',
];

type MobileAppPromptProps = {
  defaultVisible: boolean;
};

export function MobileAppPrompt({ defaultVisible }: MobileAppPromptProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!defaultVisible) return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    setVisible(true);
  }, [defaultVisible]);

  const dismiss = React.useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-prompt-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 w-full max-w-sm rounded-t-2xl sm:rounded-2xl',
          'bg-card border shadow-xl',
          'flex flex-col gap-5 p-6',
          'animate-in slide-in-from-bottom-4 duration-300 ease-out',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <SiteLogoFull className="h-9 w-auto" />
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-1.5">
          <h2 id="mobile-prompt-title" className="text-base font-semibold leading-snug">
            Better on the app
          </h2>
          <p className="text-sm text-muted-foreground">
            Get the full ICONIC Academy experience designed for your phone.
          </p>
        </div>

        {/* Benefits */}
        <ul className="flex flex-col gap-1.5" aria-label="App benefits">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-sm">
              <span className="size-4 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        {/* Store CTAs */}
        <MarketingStoreBadges layout="inline" size="medium" className="flex-nowrap" />

        {/* Web fallback */}
        <div className="text-center">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Continue on web instead
          </button>
        </div>
      </div>
    </div>
  );
}
