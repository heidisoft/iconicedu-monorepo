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
    setRole(access?.role);
    setError(null);
    if (!enabled || !connected || !repo) return;
    const provider = collaboration ?? new HttpWhiteboardCollaborationProvider(repo);
    let lastPresentation: boolean | undefined;
    const disconnect = provider.connect(
      (snapshot) => {
        setRole(snapshot.role);
        const presenting = snapshot.presentationActive === true;
        if (pending.current) return;
        if (presenting !== lastPresentation) {
          lastPresentation = presenting;
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
    if (role !== 'teacher') {
      setOpen((previous) => !previous);
      return;
    }
    pending.current = true;
    try {
      await repo.save({ id: crypto.randomUUID(), type: 'presentation', enabled: !open });
      setOpen(!open);
    } catch {
      setError(
        'Unable to update whiteboard presentation. Check your connection and retry.',
      );
    } finally {
      pending.current = false;
    }
  }, [enabled, repo, role, open]);
  return {
    open,
    role,
    presenting: open && role === 'teacher',
    error,
    toggle,
    dismissError: () => setError(null),
  };
}
