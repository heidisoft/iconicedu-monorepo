'use client';

import * as React from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

import { getPublicTurnstileSiteKey } from '@iconicedu/web/lib/config/env';

const SITE_KEY = getPublicTurnstileSiteKey();

/**
 * True when a Cloudflare Turnstile site key is configured. When false the widget
 * renders nothing and callers send no `captchaToken` — correct while Supabase
 * Attack Protection is disabled (local dev, CI, pre-rollout).
 */
export function isTurnstileConfigured(): boolean {
  return SITE_KEY !== null;
}

export type TurnstileFieldHandle = {
  /** Drop the current token and fetch a fresh one — Turnstile tokens are single-use. */
  reset: () => void;
};

type TurnstileFieldProps = {
  /** Called with the token on success, or `null` on mount / expiry / error / reset. */
  onTokenChange: (token: string | null) => void;
  className?: string;
};

/**
 * Managed ("interaction-only") Turnstile widget for the passwordless auth forms.
 * Most visitors never see it; Cloudflare only shows a challenge when it wants
 * interaction. Renders nothing when unconfigured.
 */
export const TurnstileField = React.forwardRef<TurnstileFieldHandle, TurnstileFieldProps>(
  function TurnstileField({ onTokenChange, className }, ref) {
    const widgetRef = React.useRef<TurnstileInstance | null>(null);

    React.useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          onTokenChange(null);
          widgetRef.current?.reset();
        },
      }),
      [onTokenChange],
    );

    if (SITE_KEY === null) {
      return null;
    }

    return (
      <Turnstile
        ref={widgetRef}
        siteKey={SITE_KEY}
        className={className}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange(null)}
        onError={() => onTokenChange(null)}
        options={{ appearance: 'interaction-only', theme: 'auto', size: 'flexible' }}
      />
    );
  },
);
