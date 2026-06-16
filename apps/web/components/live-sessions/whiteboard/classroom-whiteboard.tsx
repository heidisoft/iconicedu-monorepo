'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type {
  AppState,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import '@excalidraw/excalidraw/index.css';

import { useWhiteboardSync } from '@iconicedu/web/components/live-sessions/whiteboard/use-whiteboard-sync';
import type {
  PointerUpdate,
  ViewportState,
} from '@iconicedu/web/components/live-sessions/whiteboard/use-whiteboard-sync';
import { WhiteboardToolbar } from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar';
import type { WhiteboardToolbarCallbacks } from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar';
import { TEACHER_TOOLBAR } from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar-config';

// ─── Element merge ────────────────────────────────────────────────────────────
// Bidirectional concurrent drawing: keep the highest-versioned copy of each
// element rather than replacing wholesale, so both sides' work survives.
function mergeElements(
  local: readonly ExcalidrawElement[],
  remote: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const map = new Map<string, ExcalidrawElement>(local.map((el) => [el.id, el]));
  for (const el of remote) {
    const existing = map.get(el.id);
    if (
      !existing ||
      el.version > existing.version ||
      (el.version === existing.version && el.versionNonce > existing.versionNonce)
    ) {
      map.set(el.id, el);
    }
  }
  return [...map.values()];
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClassroomWhiteboardProps {
  liveSessionId: string;
  supabase: SupabaseClient;
  /** Stable ID for this participant — deduplicates cursors on the canvas */
  participantId?: string;
  /** Display name shown on remote participants' cursors */
  participantName?: string;
  onLoadSnapshot?: () => Promise<Record<string, unknown> | null>;
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
  toolbarCallbacks?: WhiteboardToolbarCallbacks;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClassroomWhiteboard({
  liveSessionId,
  supabase,
  participantId,
  participantName,
  onLoadSnapshot,
  onSaveSnapshot,
  toolbarCallbacks,
}: ClassroomWhiteboardProps) {
  const toolbarItems = TEACHER_TOOLBAR;

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialElements, setInitialElements] = useState<
    readonly ExcalidrawElement[] | undefined
  >();
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );

  // Derive Follow Me initial state from the toolbar config so the UI toggle
  // and the actual broadcast state are in sync from the first render.
  const [followMeActive, setFollowMeActive] = useState(() => {
    const item = toolbarItems.find((i) => i.kind === 'action' && i.id === 'follow-me');
    return item?.kind === 'action' ? (item.defaultActive ?? false) : false;
  });
  const followMeRef = useRef(followMeActive);
  followMeRef.current = followMeActive;

  const participantIdRef = useRef(participantId ?? crypto.randomUUID());
  const participantNameRef = useRef(participantName ?? 'Anonymous');
  useEffect(() => {
    if (participantId) participantIdRef.current = participantId;
  }, [participantId]);
  useEffect(() => {
    if (participantName) participantNameRef.current = participantName;
  }, [participantName]);

  // Collaborator cursors + auto-expiry timers (2 s of inactivity → hide)
  const collaboratorsRef = useRef<Map<SocketId, Collaborator>>(new Map());
  const collaboratorTimersRef = useRef<Map<SocketId, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ── System theme sync ───────────────────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ── Snapshot load ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!onLoadSnapshot) {
      setSnapshotReady(true);
      return;
    }
    onLoadSnapshot()
      .then((snapshot) => {
        if (snapshot?.elements) {
          setInitialElements(snapshot.elements as unknown as ExcalidrawElement[]);
        }
      })
      .catch(() => {
        /* start blank if load fails */
      })
      .finally(() => setSnapshotReady(true));
  }, [onLoadSnapshot]);

  // ── Excalidraw API ──────────────────────────────────────────────────────────

  const handleExcalidrawAPI = useCallback((excalidrawApi: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = excalidrawApi;
    setApi(excalidrawApi);
  }, []);

  // ── Remote event handlers ───────────────────────────────────────────────────

  const applyRemoteElements = useCallback(
    (remoteElements: readonly ExcalidrawElement[]) => {
      const currentApi = excalidrawAPIRef.current;
      if (!currentApi) return;
      const merged = mergeElements(currentApi.getSceneElements(), remoteElements);
      currentApi.updateScene({ elements: merged });
    },
    [],
  );

  const applyRemoteViewport = useCallback((viewport: ViewportState) => {
    excalidrawAPIRef.current?.updateScene({ appState: viewport });
  }, []);

  const applyRemotePointer = useCallback((update: PointerUpdate) => {
    const currentApi = excalidrawAPIRef.current;
    if (!currentApi) return;
    const collab = collaboratorsRef.current;
    const timers = collaboratorTimersRef.current;
    const id = update.senderId as SocketId;

    collab.set(id, {
      pointer: { x: update.x, y: update.y, tool: update.tool },
      button: update.button,
      username: update.username,
      color:
        update.tool === 'laser'
          ? { background: '#e03131', stroke: '#e03131' }
          : undefined,
    });

    // Auto-remove after 2 s of no movement
    const prev = timers.get(id);
    if (prev) clearTimeout(prev);
    timers.set(
      id,
      setTimeout(() => {
        collab.delete(id);
        timers.delete(id);
        excalidrawAPIRef.current?.updateScene({ collaborators: new Map(collab) });
      }, 2000),
    );

    currentApi.updateScene({ collaborators: new Map(collab) });
  }, []);

  const getElements = useCallback(
    () => excalidrawAPIRef.current?.getSceneElements() ?? [],
    [],
  );

  // ── Sync hook ───────────────────────────────────────────────────────────────

  const { broadcastElements, broadcastViewport, broadcastPointer } = useWhiteboardSync({
    liveSessionId,
    supabase,
    onRemoteElements: applyRemoteElements,
    getElements,
    onSaveSnapshot,
    onRemoteViewport: applyRemoteViewport,
    onRemotePointer: applyRemotePointer,
  });

  // ── Scene change handler ────────────────────────────────────────────────────

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      broadcastElements(elements);
      if (followMeRef.current) {
        broadcastViewport({
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
        });
      }
    },
    [broadcastElements, broadcastViewport],
  );

  // ── Cursor broadcast via DOM ────────────────────────────────────────────────
  // We use a direct DOM pointermove listener instead of Excalidraw's onPointerUpdate
  // because onPointerUpdate only reports tool:'laser' while the mouse button is held —
  // hovering with laser selected silently reports 'pointer'.
  // snapshotReady ensures the canvas div is mounted before we attach the listener.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const currentApi = excalidrawAPIRef.current;
      if (!currentApi) return;
      const appState = currentApi.getAppState();
      // Convert screen → scene coordinates
      const x =
        (e.clientX - appState.offsetLeft) / appState.zoom.value - appState.scrollX;
      const y = (e.clientY - appState.offsetTop) / appState.zoom.value - appState.scrollY;
      broadcastPointer({
        senderId: participantIdRef.current,
        username: participantNameRef.current,
        x,
        y,
        tool: appState.activeTool.type === 'laser' ? 'laser' : 'pointer',
        button: e.buttons > 0 ? 'down' : 'up',
      });
    };

    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
    // snapshotReady re-runs this once the canvas div is in the DOM
  }, [broadcastPointer, snapshotReady]);

  // ── Follow Me toggle intercept ──────────────────────────────────────────────

  const mergedCallbacks: WhiteboardToolbarCallbacks = {
    ...toolbarCallbacks,
    onFollowMeToggle: (active) => {
      setFollowMeActive(active);
      toolbarCallbacks?.onFollowMeToggle?.(active);
    },
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!snapshotReady) {
    return (
      <div className="flex h-full min-h-48 w-full items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Loading whiteboard…</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="excalidraw-tutoring relative h-full min-h-48 w-full overflow-hidden rounded-2xl border border-border bg-card"
    >
      <style>{`
        .excalidraw-tutoring .App-toolbar-container { display: none !important; }
        .excalidraw-tutoring .main-menu-trigger     { display: none !important; }
        .excalidraw-tutoring .App-menu_top          { display: none !important; }
        .excalidraw-tutoring .HintViewer            { display: none !important; }
      `}</style>

      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        initialData={{ elements: initialElements ?? [] }}
        theme={theme}
        isCollaborating={true}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: undefined,
            export: { saveFileToDisk: true },
            toggleTheme: false,
            changeViewBackgroundColor: false,
            clearCanvas: true,
          },
          tools: { image: false },
        }}
        langCode="en"
      />

      {/* Custom toolbar pinned to the top centre */}
      <div className="absolute inset-x-0 top-3 z-10 px-4">
        <WhiteboardToolbar items={toolbarItems} api={api} callbacks={mergedCallbacks} />
      </div>
    </div>
  );
}
