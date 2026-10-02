'use client';

import { useCallback, useState } from 'react';

import {
  isExternalJoinHref,
  resolveExternalJoinProviderLabel,
} from '@iconicedu/ui-web/components/messages/live-session-join.utils';
import type { ExternalLiveSessionJoinTarget } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';

function defaultInternalNavigate(joinHref: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.location.assign(joinHref);
}

export function useExternalLiveSessionJoinDialog(input?: {
  onInternalJoinHref?: (joinHref: string) => void;
}) {
  const [target, setTarget] = useState<ExternalLiveSessionJoinTarget | null>(null);

  const closeExternalJoinDialog = useCallback(() => {
    setTarget(null);
  }, []);

  const openExternalJoinDialog = useCallback(
    (joinHref: string, providerHint?: string | null) => {
      setTarget({
        joinHref,
        providerLabel: resolveExternalJoinProviderLabel(joinHref, providerHint),
      });
    },
    [],
  );

  const handleResolvedJoinHref = useCallback(
    (joinHref: string, providerHint?: string | null) => {
      if (isExternalJoinHref(joinHref)) {
        openExternalJoinDialog(joinHref, providerHint);
        return;
      }

      const navigate = input?.onInternalJoinHref ?? defaultInternalNavigate;

      navigate(joinHref);
    },
    [input?.onInternalJoinHref, openExternalJoinDialog],
  );

  return {
    externalJoinTarget: target,
    closeExternalJoinDialog,
    openExternalJoinDialog,
    handleResolvedJoinHref,
  };
}
