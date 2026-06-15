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
  isPresenter: boolean;
  supabase: SupabaseClient;
  /** Called when remote elements arrive — should merge, not replace */
  onRemoteElements: (elements: readonly ExcalidrawElement[]) => void;
  /** Returns the current local scene (used for catch-up pushes) */
  getElements: () => readonly ExcalidrawElement[];
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
  /** Called when a viewport sync arrives (non-presenter only) */
  onRemoteViewport?: (viewport: ViewportState) => void;
  /** Called when a cursor position arrives */
  onRemotePointer?: (update: PointerUpdate) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhiteboardSync({
  liveSessionId,
  isPresenter,
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
    const channel = supabase.channel(`whiteboard:${liveSessionId}`, {
      config: { broadcast: { self: false } },
    });

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
      if (status !== 'SUBSCRIBED') return;
      channelRef.current = channel;
      // Announce presence so existing participants push their scene to us
      channel.send({ type: 'broadcast', event: JOIN_EVENT, payload: {} });
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [liveSessionId, supabase]);

  // ── Periodic snapshot save (presenter only) ─────────────────────────────────
  useEffect(() => {
    if (!isPresenter || !onSaveSnapshot) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresenter, liveSessionId, onSaveSnapshot]);

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  /** Debounced element broadcast — skipped when applying remote changes */
  const broadcastElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    if (isApplyingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      channelRef.current?.send({
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
      channelRef.current?.send({
        type: 'broadcast',
        event: VIEWPORT_EVENT,
        payload: viewport,
      });
    }, VIEWPORT_THROTTLE_MS);
  }, []);

  /** Leading-edge throttled pointer broadcast */
  const broadcastPointer = useCallback((update: PointerUpdate) => {
    if (ptrThrottleRef.current) return;
    channelRef.current?.send({
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
