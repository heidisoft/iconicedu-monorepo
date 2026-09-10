import React, { useCallback, useState } from 'react';

import {
  TurnstileWebView,
  isTurnstileConfigured,
} from '@/components/auth/turnstile-webview';

export type UseTurnstileResult = {
  /** Latest Turnstile token, or null when none is held yet. */
  token: string | null;
  /** True when a site key is configured and a token is required before OTP send. */
  required: boolean;
  /** Discard the current token and re-challenge — Turnstile tokens are single-use. */
  reset: () => void;
  /** Element to render on the screen; hosts the (usually invisible) widget. */
  widget: React.ReactNode;
};

/**
 * Owns a managed Turnstile widget for a passwordless auth screen. Render
 * `widget` somewhere in the tree, read `token` when sending an OTP, and call
 * `reset()` afterwards so the next send / resend gets a fresh token.
 */
export function useTurnstile(): UseTurnstileResult {
  const [token, setToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const required = isTurnstileConfigured();

  const reset = useCallback(() => {
    setToken(null);
    setNonce((current) => current + 1);
  }, []);

  const widget = required ? <TurnstileWebView key={nonce} onToken={setToken} /> : null;

  return { token, required, reset, widget };
}
