'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WhiteboardStatus } from '@zoom/videosdk';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { describeZoomWhiteboardFailure } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import {
  executeZoomCollaborationCommand,
  isZoomWhiteboardPresenting,
  observeZoomWhiteboardCredentialFailure,
} from '@iconicedu/web/lib/live-sessions/zoom-collaboration';

function nextPaint() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** Whiteboard owns its surface, provider events, late-join recovery and failures. */
export function useZoomWhiteboardFeature(
  client: ZoomClient | null,
  enabled: boolean,
  sessionName: string,
  activeShareUserId: number | null,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(WhiteboardStatus.Closed);
  const [presenting, setPresenting] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const failed = useRef(false);
  const active = useRef(false);
  active.current = status !== WhiteboardStatus.Closed;
  const epoch = useRef(0);
  const viewRequest = useRef(0);

  useEffect(() => {
    const generation = ++epoch.current;
    setStatus(WhiteboardStatus.Closed);
    setPresenting(false);
    setSupported(false);
    pending.current = false;
    failed.current = false;
    if (!client || !enabled) return;
    const board = client.getWhiteboardClient();
    const selfId = client.getCurrentUserInfo().userId;
    setSupported(board.isWhiteboardEnabled());
    const statusChange = (next: WhiteboardStatus) => {
      if (failed.current) return;
      setStatus(next);
      setPresenting(
        isZoomWhiteboardPresenting(next, board.getWhiteboardPresenter()?.userId, selfId),
      );
    };
    const peerChange = async (payload: { action: 'Start' | 'Stop'; userId: number }) => {
      if (payload.userId === selfId || !board.isWhiteboardEnabled()) return;
      const request = ++viewRequest.current;
      try {
        if (payload.action === 'Start') {
          failed.current = false;
          setError(null);
          setStatus(WhiteboardStatus.Pending);
          await nextPaint();
          if (epoch.current !== generation || viewRequest.current !== request) return;
          if (!containerRef.current)
            throw new Error(
              'Whiteboard drawing surface is unavailable. Try rejoining the session.',
            );
          await executeZoomCollaborationCommand(() =>
            board.startWhiteboardView(containerRef.current!, payload.userId),
          );
        } else {
          await executeZoomCollaborationCommand(() => board.stopWhiteboardView());
          if (epoch.current === generation) setStatus(WhiteboardStatus.Closed);
        }
      } catch (failure) {
        if (epoch.current !== generation) return;
        setStatus(WhiteboardStatus.Closed);
        setError(describeZoomWhiteboardFailure(failure));
      }
    };
    client.on('whiteboard-status-change', statusChange);
    client.on('peer-whiteboard-state-change', peerChange);
    const stopObserver = observeZoomWhiteboardCredentialFailure(
      window,
      () => !failed.current && (pending.current || active.current),
      (failure) => {
        failed.current = true;
        setStatus(WhiteboardStatus.Closed);
        setPresenting(false);
        setError(describeZoomWhiteboardFailure(failure));
        void executeZoomCollaborationCommand(() =>
          board.getWhiteboardPresenter()?.userId === selfId
            ? board.stopWhiteboardScreen()
            : board.stopWhiteboardView(),
        ).catch(() => undefined);
      },
    );
    const presenter = board.getWhiteboardPresenter();
    if (presenter) void peerChange({ action: 'Start', userId: presenter.userId });
    return () => {
      epoch.current = generation + 1;
      stopObserver();
      client.off('whiteboard-status-change', statusChange);
      client.off('peer-whiteboard-state-change', peerChange);
    };
  }, [client, enabled]);

  const toggle = useCallback(async () => {
    if (!client || !enabled || pending.current) return;
    pending.current = true;
    failed.current = false;
    setError(null);
    const generation = epoch.current;
    try {
      const board = client.getWhiteboardClient();
      const presenter = board.getWhiteboardPresenter();
      if (presenter?.userId === client.getCurrentUserInfo().userId) {
        await executeZoomCollaborationCommand(() => board.stopWhiteboardScreen());
        if (epoch.current !== generation) return;
        setPresenting(false);
        setStatus(WhiteboardStatus.Closed);
      } else {
        if (presenter)
          throw new Error('Another participant is already presenting a whiteboard.');
        if (!board.canStartWhiteboard())
          throw new Error(
            activeShareUserId !== null
              ? 'End screen sharing before starting the whiteboard.'
              : "Whiteboard couldn't be started — you may not have permission, or it's unavailable in this session.",
          );
        setStatus(WhiteboardStatus.Pending);
        await nextPaint();
        if (epoch.current !== generation) return;
        if (!containerRef.current)
          throw new Error(
            'Whiteboard drawing surface is unavailable. Try rejoining the session.',
          );
        await executeZoomCollaborationCommand(() =>
          board.startWhiteboardScreen(containerRef.current!),
        );
      }
    } catch (failure) {
      if (epoch.current !== generation) return;
      setStatus(WhiteboardStatus.Closed);
      setPresenting(false);
      setError(describeZoomWhiteboardFailure(failure));
    } finally {
      if (epoch.current === generation) pending.current = false;
    }
  }, [client, enabled, activeShareUserId]);

  const exportPdf = useCallback(async () => {
    if (!client || !enabled) return;
    setError(null);
    try {
      await executeZoomCollaborationCommand(() =>
        client.getWhiteboardClient().exportWhiteboard('pdf', `whiteboard-${sessionName}`),
      );
    } catch (failure) {
      setError(describeZoomWhiteboardFailure(failure));
    }
  }, [client, enabled, sessionName]);
  return {
    containerRef,
    status,
    presenting,
    supported,
    error,
    dismissError: () => setError(null),
    toggle,
    exportPdf,
  };
}
