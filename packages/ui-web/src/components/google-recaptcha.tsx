'use client';

import * as React from 'react';

const RECAPTCHA_SCRIPT_ID = 'google-recaptcha-script';
const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';

type RecaptchaApi = {
  render: (
    container: HTMLElement,
    parameters: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => number;
  reset: (widgetId: number) => void;
};

function getRecaptchaApi(): RecaptchaApi | undefined {
  return (window as typeof window & { grecaptcha?: RecaptchaApi }).grecaptcha;
}

export type GoogleRecaptchaProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
};

export function GoogleRecaptcha({
  siteKey,
  onTokenChange,
  resetKey = 0,
}: GoogleRecaptchaProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<number | null>(null);
  const hasMountedRef = React.useRef(false);
  const onTokenChangeRef = React.useRef(onTokenChange);

  React.useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  React.useEffect(() => {
    const renderWidget = () => {
      const api = getRecaptchaApi();
      if (!api || !containerRef.current || widgetIdRef.current !== null) {
        return;
      }
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChangeRef.current(token),
        'expired-callback': () => onTokenChangeRef.current(null),
        'error-callback': () => onTokenChangeRef.current(null),
      });
    };

    const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID);
    if (existingScript) {
      if (getRecaptchaApi()) {
        renderWidget();
      } else {
        existingScript.addEventListener('load', renderWidget);
      }
      return () => existingScript.removeEventListener('load', renderWidget);
    }

    const script = document.createElement('script');
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = RECAPTCHA_SCRIPT_SRC;
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
      getRecaptchaApi()?.reset(widgetIdRef.current);
      onTokenChangeRef.current(null);
    }
  }, [resetKey]);

  return (
    <div className="flex min-h-[78px] justify-center overflow-hidden">
      <div ref={containerRef} aria-label="reCAPTCHA verification" />
    </div>
  );
}
