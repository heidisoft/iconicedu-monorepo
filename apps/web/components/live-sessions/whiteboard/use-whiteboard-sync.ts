'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Zoom } from '@excalidraw/excalidraw/types';

const BROADCAST_EVENT = 'wb:op';
const VIEWPORT_EVENT = 'wb:vp';
const SAVE_INTERVAL_MS = 30_000;
const BROADCAST_DEBOUNCE_MS = 80;
const VIEWPORT_THROTTLE_MS = 150;

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: Zoom;
}

export interface UseWhiteboardSyncOptions {
  liveSessionId: string;
  isPresenter: boolean;
  supabase: SupabaseClient;
  onRemoteElements: (elements: readonly ExcalidrawElement[]) => void;
  getElements: () => readonly ExcalidrawElement[];
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
  onRemoteViewport?: (viewport: ViewportState) => void;
}

export function useWhiteboardSync({
  liveSessionId,
  isPresenter,
  supabase,
  onRemoteElements,
  getElements,
  onSaveSnapshot,
  onRemoteViewport,
}: UseWhiteboardSyncOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vpThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const onRemoteRef = useRef(onRemoteElements);
  const onRemoteViewportRef = useRef(onRemoteViewport);
  onRemoteRef.current = onRemoteElements;
  onRemoteViewportRef.current = onRemoteViewport;

  useEffect(() => {
    const channel = supabase.channel(`whiteboard:${liveSessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
      if (!payload?.elements) return;
      isApplyingRemoteRef.current = true;
      onRemoteRef.current(payload.elements as ExcalidrawElement[]);
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);
    });

    channel.on('broadcast', { event: VIEWPORT_EVENT }, ({ payload }) => {
      if (!payload || typeof payload.scrollX !== 'number') return;
      onRemoteViewportRef.current?.(payload as ViewportState);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [liveSessionId, supabase]);

  useEffect(() => {
    if (!isPresenter || !onSaveSnapshot) return;

    const save = async () => {
      const elements = getElements();
      if (elements.length === 0) return;
      try {
        await onSaveSnapshot(elements);
      } catch {
        // Non-critical — next interval will retry
      }
    };

    const interval = setInterval(save, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      void save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresenter, liveSessionId, onSaveSnapshot]);

  const broadcastElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    if (isApplyingRemoteRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: { elements },
      });
    }, BROADCAST_DEBOUNCE_MS);
  }, []);

  const broadcastViewport = useCallback((viewport: ViewportState) => {
    if (vpThrottleRef.current) return;
    vpThrottleRef.current = setTimeout(() => {
      vpThrottleRef.current = null;
      channelRef.current?.send({
        type: 'broadcast',
        event: VIEWPORT_EVENT,
        payload: viewport,
      });
    }, VIEWPORT_THROTTLE_MS);
  }, []);

  return { broadcastElements, broadcastViewport };
}
