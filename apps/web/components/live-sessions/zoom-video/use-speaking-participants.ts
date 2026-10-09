'use client';
import { useEffect, useState } from 'react';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
const SPEAKING_HOLD_MS = 1800;
export function useSpeakingParticipants(
  client: ZoomClient | null,
  connected: boolean,
  selfId: number | null,
  muted: boolean,
) {
  const [speakers, setSpeakers] = useState<Set<number>>(new Set());
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  useEffect(() => {
    setSpeakers(new Set());
    setSelfSpeaking(false);
    if (!client || !connected) return;
    const remoteTimers = new Map<number, ReturnType<typeof setTimeout>>();
    let localTimer: ReturnType<typeof setTimeout> | undefined;
    const active = (payload: Array<{ userId: number }>) => {
      for (const { userId } of payload) {
        clearTimeout(remoteTimers.get(userId));
        remoteTimers.set(
          userId,
          setTimeout(() => {
            remoteTimers.delete(userId);
            setSpeakers((previous) => {
              const next = new Set(previous);
              next.delete(userId);
              return next;
            });
          }, SPEAKING_HOLD_MS),
        );
      }
      setSpeakers(
        (previous) => new Set([...previous, ...payload.map((speaker) => speaker.userId)]),
      );
    };
    const level = ({ level }: { level: number }) => {
      // Silence events must not restart the hold or make brief word gaps flicker.
      if (!Number.isFinite(level) || level < 2) return;
      clearTimeout(localTimer);
      setSelfSpeaking(true);
      localTimer = setTimeout(() => setSelfSpeaking(false), SPEAKING_HOLD_MS);
    };
    const removed = (payload: Array<{ userId: number }>) => {
      for (const { userId } of payload) {
        clearTimeout(remoteTimers.get(userId));
        remoteTimers.delete(userId);
      }
      setSpeakers((previous) => {
        const next = new Set(previous);
        payload.forEach(({ userId }) => next.delete(userId));
        return next;
      });
    };
    client.on('active-speaker', active);
    client.on('current-audio-level-change', level);
    client.on('user-removed', removed);
    return () => {
      client.off('active-speaker', active);
      client.off('current-audio-level-change', level);
      client.off('user-removed', removed);
      remoteTimers.forEach((timer) => clearTimeout(timer));
      clearTimeout(localTimer);
    };
  }, [client, connected]);
  const result = new Set(connected ? speakers : []);
  if (selfId !== null) {
    if (muted) result.delete(selfId);
    else if (selfSpeaking) result.add(selfId);
  }
  return result;
}
