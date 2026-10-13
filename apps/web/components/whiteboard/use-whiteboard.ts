'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WhiteboardElementVM,
  WhiteboardOperationVM,
  WhiteboardSnapshotVM,
} from '@iconicedu/shared-types';
import {
  createWhiteboardRepository,
  type WhiteboardRepository,
} from '@iconicedu/web/lib/whiteboard/api';
import {
  HttpWhiteboardCollaborationProvider,
  type WhiteboardCollaborationProvider,
  type CollaborationStatus,
} from './collaboration/provider';
import { WhiteboardAutosaveQueue, type SaveStatus } from './persistence/autosave-queue';
import { changedElements } from './canvas/scene-history';

export function useWhiteboard(
  token: string,
  repository?: WhiteboardRepository,
  collaboration?: WhiteboardCollaborationProvider,
) {
  const [snapshot, setSnapshot] = useState<WhiteboardSnapshotVM | null>(null);
  const [connection, setConnection] = useState<CollaborationStatus>('connecting');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);

  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<WhiteboardAutosaveQueue | null>(null);
  const providerRef = useRef<WhiteboardCollaborationProvider | null>(null);
  const receive = useCallback((remote: WhiteboardSnapshotVM) => {
    const current = snapshotRef.current;
    if (current && remote.revision < current.revision) return;
    // Authoritative structural state plus locally pending elements; never replace unsaved strokes.
    const next = structuredClone(remote);
    for (const op of queueRef.current?.pending() ?? []) {
      if (op.type === 'student-editing' && next.role === 'teacher') {
        next.document.studentEditing = op.enabled;
        continue;
      }
      if (op.type !== 'elements') continue;
      const page = next.document.pages.find((p) => p.id === op.pageId);
      if (!page) continue;
      const map = new Map(page.elements.map((e) => [e.id, e]));
      for (const e of op.elements) {
        const old = map.get(e.id);
        if (
          !old ||
          e.version > old.version ||
          (e.version === old.version && e.nonce < old.nonce)
        )
          map.set(e.id, e);
      }
      page.elements = [...map.values()];
    }
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  useEffect(() => {
    setSnapshot(null);
    snapshotRef.current = null;
    setError(null);
    const repo = repository ?? createWhiteboardRepository(token);
    const provider = collaboration ?? new HttpWhiteboardCollaborationProvider(repo);
    const storageKey = `whiteboard-draft:${token.slice(-12)}`;
    const queue = new WhiteboardAutosaveQueue(
      repo,
      receive,
      (status, message) => {
        setSaveStatus(status);
        setError(message ?? null);
      },
      {
        get: () => sessionStorage.getItem(storageKey),
        set: (value) => sessionStorage.setItem(storageKey, value),
      },
    );
    queueRef.current = queue;
    providerRef.current = provider;
    const disconnect = provider.connect(receive, setConnection);
    queue.retry();
    return () => {
      disconnect();
      if (renderTimer.current) clearTimeout(renderTimer.current);
      renderTimer.current = null;
      queue.dispose();
      queueRef.current = null;
      providerRef.current = null;
    };
  }, [token, repository, collaboration, receive]);
  const operate = useCallback((operation: WhiteboardOperationVM) => {
    if (operation.type === 'student-editing' && snapshotRef.current?.role === 'teacher') {
      const next = {
        ...snapshotRef.current,
        document: { ...snapshotRef.current.document, studentEditing: operation.enabled },
      };
      snapshotRef.current = next;
      setSnapshot(next);
    }
    queueRef.current?.enqueue(operation);
  }, []);
  const changeElements = useCallback(
    (elements: WhiteboardElementVM[]) => {
      const current = snapshotRef.current;
      const page = current?.document.pages[0];
      if (
        !current ||
        !page ||
        (current.role === 'student' && !current.document.studentEditing)
      )
        return;
      const changed = changedElements(page.elements, elements);
      if (!changed.length) return;
      const next = {
        ...current,
        document: {
          ...current.document,
          pages: current.document.pages.map((p) =>
            p.id === page.id ? { ...p, elements } : p,
          ),
        },
      };
      snapshotRef.current = next;
      // The canvas paints its own strokes. Native controls update at most ten times/second.
      if (!renderTimer.current)
        renderTimer.current = setTimeout(() => {
          renderTimer.current = null;
          setSnapshot(snapshotRef.current);
        }, 100);
      operate({
        id: crypto.randomUUID(),
        type: 'elements',
        pageId: page.id,
        elements: changed,
      });
    },
    [operate],
  );
  return {
    snapshot,
    connection,
    saveStatus,
    error,
    changeElements,
    operate,
    recovery: () => queueRef.current?.recovery() ?? '{}',
    discard: () => {
      if (queueRef.current?.discard()) providerRef.current?.refresh();
    },
    retry: () => {
      providerRef.current?.refresh();
      queueRef.current?.retry();
    },
  };
}
