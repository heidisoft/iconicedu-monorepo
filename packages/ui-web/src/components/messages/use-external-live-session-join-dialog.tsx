'use client';

import { useCallback, useState, useRef } from 'react';

import {
  isExternalJoinHref,
  resolveExternalJoinProviderLabel,
} from '@iconicedu/ui-web/components/messages/live-session-join.utils';
import type { ExternalLiveSessionJoinTarget } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';

import { useLiveSessionJoinContext } from './live-session-join-context';

function defaultInternalNavigate(joinHref: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.location.assign(joinHref);
}

export function useExternalLiveSessionJoinDialog(input?: {
  onInternalJoinHref?: (joinHref: string) => void;
}) {
  const joinContext = useLiveSessionJoinContext();
  const generation = useRef(0);
  const [target, setTarget] = useState<ExternalLiveSessionJoinTarget | null>(null);

  const closeExternalJoinDialog = useCallback(() => {
    generation.current += 1;
    setTarget(null);
  }, []);

  const openExternalJoinDialog = useCallback(
    (
      joinHref: string,
      providerHint?: string | null,
      options?: Pick<
        ExternalLiveSessionJoinTarget,
        'isInternal' | 'copyHref' | 'passcode'
      >,
    ) => {
      setTarget({
        joinHref,
        providerLabel: resolveExternalJoinProviderLabel(joinHref, providerHint),
        ...options,
        ...(joinContext ? { linkLoading: true } : {}),
      });
      const request = ++generation.current;
      if (joinContext) {
        void joinContext
          .resolveLink(joinHref)
          .then((details) => {
            if (generation.current === request)
              setTarget((current) => {
                if (!current) return null;
                if (!details) return { ...current, linkLoading: false };
                const joinUrl = new URL(current.joinHref, window.location.href);
                if (details.sharePath)
                  joinUrl.hash = new URL(details.sharePath, window.location.href).hash;
                return {
                  ...current,
                  linkLoading: false,
                  joinHref: details.sharePath ? joinUrl.toString() : current.joinHref,
                  passcode: details.passcode,
                  copyHref: details.sharePath ?? details.joinPath,
                };
              });
          })
          .catch(() => {
            if (generation.current === request)
              setTarget((current) =>
                current ? { ...current, passcodeError: true, linkLoading: false } : null,
              );
          });
      }
    },
    [joinContext],
  );

  const handleResolvedJoinHref = useCallback(
    (joinHref: string, providerHint?: string | null, passcode?: string | null) => {
      if (
        isExternalJoinHref(joinHref) ||
        (joinContext && /^\/live\/[^/?#]+/.test(joinHref))
      ) {
        openExternalJoinDialog(joinHref, providerHint, { passcode });
        return;
      }

      const navigate = input?.onInternalJoinHref ?? defaultInternalNavigate;

      navigate(joinHref);
    },
    [input?.onInternalJoinHref, openExternalJoinDialog, joinContext],
  );

  return {
    externalJoinTarget: target,
    closeExternalJoinDialog,
    openExternalJoinDialog,
    handleResolvedJoinHref,
  };
}
