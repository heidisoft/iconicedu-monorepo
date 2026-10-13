'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import {
  MeetingShareCompositor,
  RecordingContentError,
  type RecordingSurface,
} from './meeting-share-compositor';
const messageType = 'meeting-composited-share-v1';

export function useRecordingShareCompositor(
  client: ZoomClient | null,
  sharing: boolean,
  surface: () => RecordingSurface | null,
  onFailure: () => void,
  activePresenter: number | null = null,
) {
  const latest = useRef({ surface, onFailure, activePresenter });
  latest.current = { surface, onFailure, activePresenter };
  const compositor = useRef<MeetingShareCompositor | null>(null);
  const ready = useRef(false);
  const [composited, setComposited] = useState<ReadonlySet<number>>(new Set());
  const known = useRef(new Set<number>());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ready.current = false;
    known.current = new Set();
    setComposited(new Set());
    if (!client) return;
    const instance = new MeetingShareCompositor(
      client.getMediaStream(),
      () => latest.current.surface(),
      () => {
        ready.current = false;
        void client
          .getCommandClient()
          .send(JSON.stringify({ type: messageType, active: false }))
          .catch(() => {});
        setError(
          'Shared content could not be included in the recording. Check the presenter’s browser and retry.',
        );
        latest.current.onFailure();
      },
    );
    compositor.current = instance;
    const receive = ({ senderId, text }: { senderId: string; text: string }) => {
      if (!/^[0-9]+$/.test(senderId)) return;
      let value: { type?: unknown; active?: unknown };
      try {
        value = JSON.parse(text);
        if (!value || typeof value !== 'object') return;
      } catch {
        return;
      }
      if (value.type !== messageType || typeof value.active !== 'boolean') return;
      // Sender ID is supplied by Zoom; message bodies cannot claim another presenter.
      const id = Number(senderId);
      if (value.active) known.current.add(id);
      else {
        const wasComposited = known.current.delete(id);
        if (wasComposited && id === latest.current.activePresenter) {
          setError(
            'The presenter stopped publishing annotation content. Ask them to re-share before resuming recording.',
          );
          latest.current.onFailure();
        }
      }
      setComposited(new Set(known.current));
    };
    const stop = (payload: { userId: number; action: string }) => {
      if (payload.action === 'Stop') {
        known.current.delete(payload.userId);
        setComposited(new Set(known.current));
      }
    };
    client.on('peer-share-state-change', stop);
    client.on('command-channel-message', receive);
    return () => {
      client.off('command-channel-message', receive);
      client.off('peer-share-state-change', stop);
      compositor.current = null;
      void instance.dispose().catch(() => {});
    };
  }, [client]);
  useEffect(() => {
    if (!client) return;
    const send = () =>
      void client
        .getCommandClient()
        .send(JSON.stringify({ type: messageType, active: sharing && ready.current }))
        .catch(() => {});
    send();
    // Late joiners recover source metadata without trusting a frontend user ID.
    const timer = setInterval(send, 2000);
    return () => clearInterval(timer);
  }, [client, sharing]);
  const prepare = useCallback(async (required = true) => {
    try {
      if (!compositor.current) throw new RecordingContentError('Call is not ready');
      await compositor.current.prepare();
      ready.current = true;
      setError(null);
    } catch (error) {
      ready.current = false;
      if (required)
        throw error instanceof RecordingContentError
          ? error
          : new RecordingContentError(
              'Unable to prepare shared canvas recording. Retry from a supported desktop browser.',
            );
    }
  }, []);
  const ensurePresenter = useCallback(async (id: number) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (known.current.has(id)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new RecordingContentError(
      'The presenter’s browser is not publishing annotations for recording. Ask them to re-share from a supported desktop browser.',
    );
  }, []);
  return {
    prepare,
    ensurePresenter,
    composited,
    setMode: (mode: RecordingSurface['mode']) => compositor.current?.setMode(mode),
    error,
    dismissError: () => setError(null),
  };
}
