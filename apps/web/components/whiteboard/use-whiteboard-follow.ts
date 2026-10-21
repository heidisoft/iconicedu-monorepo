import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WhiteboardSnapshotVM,
  WhiteboardViewportVM,
  WhiteboardViewportPresenceVM,
} from '@iconicedu/shared-types';
import {
  createWhiteboardRepository,
  type WhiteboardRepository,
} from '@iconicedu/web/lib/whiteboard/api';

/** Poll ephemeral viewports separately from durable drawing changes. */
export function useWhiteboardFollow(
  token: string,
  repository: WhiteboardRepository | undefined,
  snapshot: WhiteboardSnapshotVM | null,
  enabled: boolean,
  receive: (viewport: WhiteboardViewportVM, sourceKey?: string) => void,
) {
  const repo = useMemo(
    () => repository ?? createWhiteboardRepository(token),
    [repository, token],
  );
  const [writers, setWriters] = useState<WhiteboardViewportPresenceVM[]>([]);
  const [following, setFollowing] = useState('tutor');
  const [focusRequest, setFocusRequest] = useState(0);
  const focusTutor = useCallback(() => {
    setFollowing('tutor');
    setFocusRequest((value) => value + 1);
  }, []);
  const [status, setStatus] = useState<'waiting' | 'following' | 'reconnecting'>(
    'waiting',
  );
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const latest = useRef<WhiteboardViewportVM | null>(null);
  const generation = useRef(0);
  const target =
    following === 'tutor'
      ? snapshot?.presence.find(
          (person) => person.role === 'teacher' && person.id !== snapshot.actorId,
        )?.id
      : following === 'free'
        ? undefined
        : following;
  const publish = useCallback((viewport: WhiteboardViewportVM) => {
    latest.current = viewport;
  }, []);
  useEffect(() => {
    setFollowing('tutor');
    latest.current = null;
  }, [token]);
  useEffect(() => {
    if (
      !enabled ||
      (repository && (!repository.viewports || !repository.publishViewport))
    )
      return;
    const epoch = ++generation.current;
    let active = true,
      reading = false,
      writing = false,
      focused = false;
    setStatus('waiting');
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const peers = await repo.viewports!();
        const candidates = peers.filter((person) => person.expiresAt > Date.now());
        if (active)
          setWriters(
            candidates.filter(
              (person) =>
                person.actorId !== snapshotRef.current?.actorId &&
                !!person.viewport.writing,
            ),
          );
        if (focused || following === 'free') return;
        // A tutor may have rejoined with a new capability; choose a currently publishing tutor.
        const peer =
          following === 'tutor'
            ? candidates
                .filter((person) =>
                  snapshotRef.current?.presence.some(
                    (actor) =>
                      actor.id === person.actorId &&
                      actor.role === 'teacher' &&
                      actor.id !== snapshotRef.current?.actorId,
                  ),
                )
                .sort((a, b) => b.expiresAt - a.expiresAt)[0]
            : candidates.find((person) => person.actorId === target);
        if (active) {
          setStatus(peer ? 'following' : 'waiting');
          if (peer) {
            focused = true;
            const viewport = peer.viewport.writing
              ? {
                  ...peer.viewport,
                  centerX: peer.viewport.writing.x,
                  centerY: peer.viewport.writing.y,
                }
              : peer.viewport;
            receive(viewport, `${peer.actorId}:${epoch}`);
          }
        }
      } catch {
        if (active) setStatus('reconnecting');
      } finally {
        reading = false;
      }
    };
    const write = async () => {
      if (writing || !latest.current) return;
      writing = true;
      try {
        await repo.publishViewport!(latest.current);
      } catch {
        /* Publishing failures must never block following another person. */
      } finally {
        writing = false;
      }
    };
    void read();
    void write();
    const timer = setInterval(() => {
      void read();
      void write();
    }, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, repository, repo, enabled, target, following, receive, focusRequest]);
  return { writers, following, setFollowing, focusTutor, publish, status };
}
