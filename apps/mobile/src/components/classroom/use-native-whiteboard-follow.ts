import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WhiteboardSnapshotVM,
  WhiteboardViewportVM,
  WhiteboardViewportPresenceVM,
} from '@iconicedu/shared-types';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import type { NativeWhiteboardRepository } from './native-whiteboard';

/** Poll ephemeral viewports separately from durable drawing changes. */
export function useNativeWhiteboardFollow(
  token: string,
  repository: NativeWhiteboardRepository | undefined,
  snapshot: WhiteboardSnapshotVM | null,
  enabled: boolean,
  receive: (viewport: WhiteboardViewportVM, sourceKey?: string) => void,
) {
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
      if (reading || focused || following === 'free') return;
      reading = true;
      try {
        const peers = repository
          ? await repository.viewports!()
          : await capabilityGet<WhiteboardViewportPresenceVM[]>(
              '/whiteboards/current/viewport',
              token,
            );
        const candidates = peers.filter((person) => person.expiresAt > Date.now());
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
        if (repository) await repository.publishViewport!(latest.current);
        else await capabilityPost('/whiteboards/current/viewport', token, latest.current);
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
  }, [token, repository, enabled, target, following, receive, focusRequest]);
  return { following, setFollowing, focusTutor, publish, status };
}
