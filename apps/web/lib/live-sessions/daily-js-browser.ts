'use client';

type DailyCallFrame = {
  join: (args: { url: string }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (event: string, callback: (...args: unknown[]) => void) => DailyCallFrame;
};

type DailyIframeGlobal = {
  createFrame: (
    element: HTMLElement,
    properties?: Record<string, unknown>,
  ) => DailyCallFrame;
};

declare global {
  interface Window {
    DailyIframe?: DailyIframeGlobal;
  }
}

const DAILY_JS_SCRIPT_SRC = 'https://unpkg.com/@daily-co/daily-js';

let dailyJsPromise: Promise<DailyIframeGlobal> | null = null;

export function loadDailyJs(): Promise<DailyIframeGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Daily SDK can only load in the browser'));
  }

  if (window.DailyIframe) {
    return Promise.resolve(window.DailyIframe);
  }

  if (dailyJsPromise) {
    return dailyJsPromise;
  }

  dailyJsPromise = new Promise<DailyIframeGlobal>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${DAILY_JS_SCRIPT_SRC}"]`,
    );

    const handleLoad = () => {
      if (window.DailyIframe) {
        resolve(window.DailyIframe);
        return;
      }
      reject(new Error('Daily SDK loaded without exposing DailyIframe'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Daily SDK')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = DAILY_JS_SCRIPT_SRC;
    script.async = true;
    script.onload = handleLoad;
    script.onerror = () => reject(new Error('Failed to load Daily SDK'));
    document.head.appendChild(script);
  });

  return dailyJsPromise;
}

export type { DailyCallFrame };
