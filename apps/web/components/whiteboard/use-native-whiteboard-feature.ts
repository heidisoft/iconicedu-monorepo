'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WhiteboardAccessVM, WhiteboardRole } from '@iconicedu/shared-types';
import {
  createWhiteboardRepository,
  type WhiteboardRepository,
} from '@iconicedu/web/lib/whiteboard/api';
import {
  HttpWhiteboardCollaborationProvider,
  type WhiteboardCollaborationProvider,
} from './collaboration/provider';

/** Shared presentation is application state, never a video SDK command. */
export function useNativeWhiteboardFeature(
  access: WhiteboardAccessVM | undefined,
  enabled: boolean,
  connected: boolean,
  repository?: WhiteboardRepository,
  collaboration?: WhiteboardCollaborationProvider,
) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [role, setRole] = useState<WhiteboardRole | undefined>(access?.role);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const repo = useMemo(
    () =>
      access?.token ? (repository ?? createWhiteboardRepository(access.token)) : null,
    [access?.token, repository],
  );
  useEffect(() => {
    setOpen(false);
    setActive(false);
    setPresenting(false);
    setRole(access?.role);
    setError(null);
    if (!enabled || !connected || !repo) return;
    const provider = collaboration ?? new HttpWhiteboardCollaborationProvider(repo);
    let lastPresentation: string | undefined;
    const disconnect = provider.connect(
      (snapshot) => {
        setRole(snapshot.role);
        const presenting = snapshot.presentationActive === true;
        setActive(presenting);
        setPresenting(
          presenting &&
            !!snapshot.actorId &&
            snapshot.actorId === snapshot.document.presentation?.presenterId,
        );
        if (pending.current) return;
        const key = presenting
          ? (snapshot.document.presentation?.presentationId ??
            snapshot.document.presentation?.presenterId ??
            'active')
          : 'closed';
        if (key !== lastPresentation) {
          lastPresentation = key;
          setOpen(presenting);
        }
      },
      () => {},
    );
    return () => disconnect();
  }, [access?.role, enabled, connected, repo, collaboration]);
  const toggle = useCallback(async () => {
    if (!enabled || pending.current) return;
    if (!repo) {
      setError('The class whiteboard is temporarily unavailable. Rejoin to retry.');
      return;
    }
    setError(null);
    if (active) {
      setOpen((previous) => !previous);
      return;
    }
    pending.current = true;
    try {
      await repo.save({ id: crypto.randomUUID(), type: 'presentation', enabled: true });
      setOpen(true);
      setActive(true);
      setPresenting(true);
    } catch {
      setError(
        'Unable to update whiteboard presentation. Check your connection and retry.',
      );
    } finally {
      pending.current = false;
    }
  }, [enabled, repo, active]);
  const stop = useCallback(async () => {
    if (!repo || pending.current || !presenting) return;
    pending.current = true;
    setError(null);
    try {
      await repo.save({ id: crypto.randomUUID(), type: 'presentation', enabled: false });
      setActive(false);
      setOpen(false);
      setPresenting(false);
    } catch {
      setError(
        'Unable to stop whiteboard presentation. Check your connection and retry.',
      );
    } finally {
      pending.current = false;
    }
  }, [repo, presenting]);
  return {
    open,
    role,
    presenting,
    active,
    canStop: active && presenting,
    stop,
    error,
    toggle,
    dismissError: () => setError(null),
  };
}
