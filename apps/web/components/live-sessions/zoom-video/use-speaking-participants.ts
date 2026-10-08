'use client';
import { useEffect, useState } from 'react';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
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
    let remoteTimer: ReturnType<typeof setTimeout> | undefined;
    let localTimer: ReturnType<typeof setTimeout> | undefined;
    const active = (payload: Array<{ userId: number }>) => {
      clearTimeout(remoteTimer);
      setSpeakers(new Set(payload.map((speaker) => speaker.userId)));
      remoteTimer = setTimeout(() => setSpeakers(new Set()), 1500);
    };
    const level = ({ level }: { level: number }) => {
      clearTimeout(localTimer);
      setSelfSpeaking(Number.isFinite(level) && level >= 2);
      localTimer = setTimeout(() => setSelfSpeaking(false), 750);
    };
    client.on('active-speaker', active);
    client.on('current-audio-level-change', level);
    return () => {
      client.off('active-speaker', active);
      client.off('current-audio-level-change', level);
      clearTimeout(remoteTimer);
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
