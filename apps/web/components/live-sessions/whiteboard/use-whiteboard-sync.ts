'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Zoom } from '@excalidraw/excalidraw/types';

// ─── Event names ──────────────────────────────────────────────────────────────
const ELEMENTS_EVENT = 'wb:op'; // incremental element broadcast
const VIEWPORT_EVENT = 'wb:vp'; // Follow-Me viewport sync
const POINTER_EVENT = 'wb:ptr'; // real-time cursor positions
const JOIN_EVENT = 'wb:join'; // new participant catch-up signal

// ─── Timing constants ─────────────────────────────────────────────────────────
const ELEMENTS_DEBOUNCE_MS = 80;
const VIEWPORT_THROTTLE_MS = 150;
const POINTER_THROTTLE_MS = 40;
const SAVE_INTERVAL_MS = 30_000;
const MAX_SUBSCRIBE_RETRIES = 3;

// ─── Exported types ───────────────────────────────────────────────────────────

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: Zoom;
}

export interface PointerUpdate {
  senderId: string;
  username?: string;
  x: number;
  y: number;
  tool: 'pointer' | 'laser';
  button: 'up' | 'down';
}

export interface UseWhiteboardSyncOptions {
  liveSessionId: string;
  supabase: SupabaseClient;
  /** Called when remote elements arrive — should merge, not replace */
  onRemoteElements: (elements: readonly ExcalidrawElement[]) => void;
  /** Returns the current local scene (used for catch-up pushes) */
  getElements: () => readonly ExcalidrawElement[];
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
  /** Called when a viewport sync arrives */
  onRemoteViewport?: (viewport: ViewportState) => void;
  /** Called when a cursor position arrives */
  onRemotePointer?: (update: PointerUpdate) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhiteboardSync({
  liveSessionId,
  supabase,
  onRemoteElements,
  getElements,
  onSaveSnapshot,
  onRemoteViewport,
  onRemotePointer,
}: UseWhiteboardSyncOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vpThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ptrThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRef = useRef(false);
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null);
  const pendingViewportRef = useRef<ViewportState | null>(null);
  const pendingPointerRef = useRef<PointerUpdate | null>(null);

  // Keep latest callback/getter refs so channel handlers are never stale
  const onRemoteRef = useRef(onRemoteElements);
  const onRemoteViewportRef = useRef(onRemoteViewport);
  const onRemotePointerRef = useRef(onRemotePointer);
  const getElementsRef = useRef(getElements);
  onRemoteRef.current = onRemoteElements;
  onRemoteViewportRef.current = onRemoteViewport;
  onRemotePointerRef.current = onRemotePointer;
  getElementsRef.current = getElements;

  // ── Channel subscription ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let retryCount = 0;
    let currentChannel: RealtimeChannel | null = null;

    const flushPendingBroadcasts = () => {
      const channel = channelRef.current;
      if (!channel) return;

      const pendingElements = pendingElementsRef.current;
      if (pendingElements) {
        pendingElementsRef.current = null;
        channel.send({
          type: 'broadcast',
          event: ELEMENTS_EVENT,
          payload: { elements: pendingElements },
        });
      }

      const pendingViewport = pendingViewportRef.current;
      if (pendingViewport) {
        pendingViewportRef.current = null;
        channel.send({
          type: 'broadcast',
          event: VIEWPORT_EVENT,
          payload: pendingViewport,
        });
      }

      const pendingPointer = pendingPointerRef.current;
      if (pendingPointer) {
        pendingPointerRef.current = null;
        channel.send({
          type: 'broadcast',
          event: POINTER_EVENT,
          payload: pendingPointer,
        });
      }
    };

    const subscribe = () => {
      const channel = supabase.channel(`whiteboard:${liveSessionId}`, {
        config: { broadcast: { self: false } },
      });
      currentChannel = channel;

      // Element updates — merge, never replace
      channel.on('broadcast', { event: ELEMENTS_EVENT }, ({ payload }) => {
        if (!payload?.elements) return;
        isApplyingRef.current = true;
        onRemoteRef.current(payload.elements as ExcalidrawElement[]);
        setTimeout(() => {
          isApplyingRef.current = false;
        }, 0);
      });

      // Viewport sync (Follow-Me)
      channel.on('broadcast', { event: VIEWPORT_EVENT }, ({ payload }) => {
        if (!payload || typeof payload.scrollX !== 'number') return;
        onRemoteViewportRef.current?.(payload as ViewportState);
      });

      // Cursor positions
      channel.on('broadcast', { event: POINTER_EVENT }, ({ payload }) => {
        if (!payload?.senderId) return;
        onRemotePointerRef.current?.(payload as PointerUpdate);
      });

      // Catch-up: any participant signals join → all others push their current scene.
      channel.on('broadcast', { event: JOIN_EVENT }, () => {
        const elements = getElementsRef.current();
        if (elements.length === 0) return;
        channel.send({
          type: 'broadcast',
          event: ELEMENTS_EVENT,
          payload: { elements },
        });
      });

      channel.subscribe((status) => {
        if (!active) return;

        if (status === 'SUBSCRIBED') {
          retryCount = 0;
          channelRef.current = channel;
          flushPendingBroadcasts();
          // Announce presence so existing participants push their scene to us
          channel.send({ type: 'broadcast', event: JOIN_EVENT, payload: {} });
          return;
        }

        if (
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') &&
          retryCount < MAX_SUBSCRIBE_RETRIES
        ) {
          retryCount += 1;
          channelRef.current = null;
          const failedChannel = channel;
          setTimeout(() => {
            if (!active) return;
            void supabase.removeChannel(failedChannel);
            subscribe();
          }, 1000 * retryCount);
        }
      });
    };

    subscribe();

    return () => {
      active = false;
      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
      }
      channelRef.current = null;
    };
  }, [liveSessionId, supabase]);

  // ── Periodic snapshot save ─────────────────────────────────────────────────
  useEffect(() => {
    if (!onSaveSnapshot) return;

    const save = async () => {
      const elements = getElementsRef.current();
      if (elements.length === 0) return;
      try {
        await onSaveSnapshot(elements);
      } catch {
        /* retry next interval */
      }
    };

    const id = setInterval(save, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      void save();
    };
  }, [liveSessionId, onSaveSnapshot]);

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  /** Debounced element broadcast — skipped when applying remote changes */
  const broadcastElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    if (isApplyingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const channel = channelRef.current;
      if (!channel) {
        pendingElementsRef.current = elements;
        return;
      }
      channel.send({
        type: 'broadcast',
        event: ELEMENTS_EVENT,
        payload: { elements },
      });
    }, ELEMENTS_DEBOUNCE_MS);
  }, []);

  /** Throttled viewport broadcast for Follow-Me */
  const broadcastViewport = useCallback((viewport: ViewportState) => {
    if (vpThrottleRef.current) return;
    vpThrottleRef.current = setTimeout(() => {
      vpThrottleRef.current = null;
      const channel = channelRef.current;
      if (!channel) {
        pendingViewportRef.current = viewport;
        return;
      }
      channel.send({
        type: 'broadcast',
        event: VIEWPORT_EVENT,
        payload: viewport,
      });
    }, VIEWPORT_THROTTLE_MS);
  }, []);

  /** Leading-edge throttled pointer broadcast */
  const broadcastPointer = useCallback((update: PointerUpdate) => {
    if (ptrThrottleRef.current) return;
    const channel = channelRef.current;
    if (!channel) {
      pendingPointerRef.current = update;
      return;
    }
    channel.send({
      type: 'broadcast',
      event: POINTER_EVENT,
      payload: update,
    });
    ptrThrottleRef.current = setTimeout(() => {
      ptrThrottleRef.current = null;
    }, POINTER_THROTTLE_MS);
  }, []);

  return { broadcastElements, broadcastViewport, broadcastPointer };
}
