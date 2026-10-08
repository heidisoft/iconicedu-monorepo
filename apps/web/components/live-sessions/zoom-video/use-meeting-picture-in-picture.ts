'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutomaticPipMode = 'always' | 'tabs' | 'sharing' | 'never';
const preferenceKey = 'meeting-automatic-pip';
interface DocumentPipApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window?: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPipApi;
  }
}

/** Move the portal root, rather than remounting video/canvas nodes or the call. */
export function useMeetingPictureInPicture({
  connected,
  sharing,
  cameraActive,
  microphoneActive,
}: {
  connected: boolean;
  sharing: boolean;
  cameraActive: boolean;
  microphoneActive: boolean;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [mode, setMode] = useState<AutomaticPipMode>('tabs');
  const [error, setError] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);
  const [sharePrompt, setSharePrompt] = useState(false);
  const activeWindow = useRef<Window | null>(null);
  const opening = useRef(false);
  const mounted = useRef(false);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const autoTab = mode === 'always' || mode === 'tabs';
  const supported = typeof window !== 'undefined' && !!window.documentPictureInPicture;

  useEffect(() => {
    mounted.current = true;
    const root = document.createElement('div');
    root.dataset.meetingPortal = '';
    document.body.append(root);
    setHost(root);
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (['always', 'tabs', 'sharing', 'never'].includes(saved ?? ''))
        setMode(saved as AutomaticPipMode);
    } catch {
      /* Private browsing may disable preference storage. */
    }
    return () => {
      mounted.current = false;
      activeWindow.current?.close();
      root.remove();
    };
  }, []);

  const restore = useCallback(() => {
    window.focus();
    activeWindow.current?.close();
    setReturned(false);
  }, []);
  const setAutomaticMode = useCallback((next: AutomaticPipMode) => {
    setMode(next);
    try {
      localStorage.setItem(preferenceKey, next);
    } catch {
      /* Session preference still works. */
    }
  }, []);

  const open = useCallback(
    async (automatic = false) => {
      if (!host || !connectedRef.current || activeWindow.current || opening.current)
        return;
      if (!window.documentPictureInPicture) {
        if (!automatic)
          setError(
            'Picture-in-picture is available in supported desktop browsers such as Chrome and Edge.',
          );
        return;
      }
      opening.current = true;
      try {
        const target = await window.documentPictureInPicture.requestWindow({
          width: 540,
          height: 480,
        });
        if (!mounted.current || !connectedRef.current) {
          target.close();
          return;
        }
        activeWindow.current = target;
        target.document.title = 'Live class · Picture-in-picture';
        const syncTheme = () => {
          target.document.body.className = document.body.className;
          target.document.documentElement.className = document.documentElement.className;
          target.document.documentElement.style.cssText =
            document.documentElement.style.cssText;
        };
        const base = target.document.createElement('base');
        base.href = document.baseURI;
        target.document.head.append(base);
        syncTheme();
        // Clone stylesheets, not call content. The original DOM and React handlers stay live.
        const syncStyles = () => {
          target.document.head
            .querySelectorAll('[data-meeting-styles]')
            .forEach((node) => node.remove());
          document.head
            .querySelectorAll('link[rel="stylesheet"],style')
            .forEach((node) => {
              const copy = node.cloneNode(true) as HTMLElement;
              copy.dataset.meetingStyles = '';
              target.document.head.append(copy);
            });
        };
        syncStyles();
        const styles = new MutationObserver(syncStyles);
        styles.observe(document.head, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        const theme = new MutationObserver(syncTheme);
        theme.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style'],
        });
        target.document.body.style.margin = '0';
        host.dataset.meetingPip = '';
        target.document.body.append(host);
        let restored = false;
        const onClose = () => {
          if (restored) return;
          restored = true;
          styles.disconnect();
          theme.disconnect();
          delete host.dataset.meetingPip;
          if (mounted.current) document.body.append(host);
          if (activeWindow.current === target) activeWindow.current = null;
          if (mounted.current) {
            setPipWindow(null);
            setReturned(automatic && connectedRef.current);
          }
        };
        target.addEventListener('pagehide', onClose, { once: true });
        setPipWindow(target);
        setError(null);
        setReturned(false);
        setSharePrompt(false);
      } catch {
        if (mounted.current && !automatic)
          setError(
            'Unable to open picture-in-picture. Allow it in your browser’s site settings, then try again.',
          );
        // Browser-denied automatic requests must not interrupt the call or create repeated alerts.
      } finally {
        opening.current = false;
      }
    },
    [host],
  );

  useEffect(() => {
    if (!connected) {
      activeWindow.current?.close();
      return;
    }
    if (!supported || !navigator.mediaSession || !autoTab) return;
    const action = 'enterpictureinpicture' as MediaSessionAction;
    try {
      navigator.mediaSession.setActionHandler(action, () => void open(document.hidden));
    } catch {
      return;
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        /* Unsupported action. */
      }
    };
  }, [connected, supported, autoTab, open]);

  useEffect(() => {
    if (!navigator.mediaSession) return;
    try {
      void navigator.mediaSession
        .setCameraActive?.(connected && cameraActive)
        ?.catch(() => {});
      void navigator.mediaSession
        .setMicrophoneActive?.(connected && microphoneActive)
        ?.catch(() => {});
    } catch {
      /* Older browsers may not implement conferencing metadata. */
    }
  }, [connected, cameraActive, microphoneActive]);

  const previousSharing = useRef(false);
  useEffect(() => {
    const started = sharing && !previousSharing.current;
    previousSharing.current = sharing;
    if (!sharing) setSharePrompt(false);
    if (started && connected && supported && (mode === 'always' || mode === 'sharing')) {
      setSharePrompt(true);
      void open(true);
    }
  }, [sharing, connected, supported, mode, open]);

  return {
    host,
    pipWindow,
    supported,
    open,
    restore,
    mode,
    setAutomaticMode,
    error,
    clearError: () => setError(null),
    returned,
    dismissReturn: () => setReturned(false),
    sharePrompt,
  };
}
