'use client';

import * as React from 'react';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    parameters: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

function getTurnstileApi(): TurnstileApi | undefined {
  return (window as typeof window & { turnstile?: TurnstileApi }).turnstile;
}

export type TurnstileProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
};

export function Turnstile({ siteKey, onTokenChange, resetKey = 0 }: TurnstileProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenChangeRef = React.useRef(onTokenChange);
  const hasMountedRef = React.useRef(false);

  React.useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  React.useEffect(() => {
    const renderWidget = () => {
      const api = getTurnstileApi();
      if (!api || !containerRef.current || widgetIdRef.current !== null) return;

      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChangeRef.current(token),
        'expired-callback': () => onTokenChangeRef.current(null),
        'error-callback': () => onTokenChangeRef.current(null),
      });
    };

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existingScript) {
      if (getTurnstileApi()) renderWidget();
      else existingScript.addEventListener('load', renderWidget);
      return () => existingScript.removeEventListener('load', renderWidget);
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', renderWidget);
    document.head.appendChild(script);
    return () => script.removeEventListener('load', renderWidget);
  }, [siteKey]);

  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (widgetIdRef.current !== null) {
      getTurnstileApi()?.reset(widgetIdRef.current);
      onTokenChangeRef.current(null);
    }
  }, [resetKey]);

  return (
    <div className="flex min-h-[65px] justify-center overflow-hidden">
      <div ref={containerRef} aria-label="Cloudflare Turnstile verification" />
    </div>
  );
}
