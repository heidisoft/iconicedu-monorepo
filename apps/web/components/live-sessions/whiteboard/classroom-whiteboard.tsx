'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import '@excalidraw/excalidraw/index.css';

import { useWhiteboardSync } from '@iconicedu/web/components/live-sessions/whiteboard/use-whiteboard-sync';
import type { ViewportState } from '@iconicedu/web/components/live-sessions/whiteboard/use-whiteboard-sync';
import { WhiteboardToolbar } from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar';
import type { WhiteboardToolbarCallbacks } from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar';
import {
  STUDENT_TOOLBAR,
  TEACHER_TOOLBAR,
} from '@iconicedu/web/components/live-sessions/whiteboard/whiteboard-toolbar-config';

export interface ClassroomWhiteboardProps {
  liveSessionId: string;
  isPresenter: boolean;
  supabase: SupabaseClient;
  onLoadSnapshot?: () => Promise<Record<string, unknown> | null>;
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
  toolbarCallbacks?: WhiteboardToolbarCallbacks;
}

export function ClassroomWhiteboard({
  liveSessionId,
  isPresenter,
  supabase,
  onLoadSnapshot,
  onSaveSnapshot,
  toolbarCallbacks,
}: ClassroomWhiteboardProps) {
  // Hoisted so the useState initializer below can reference it
  const toolbarItems = isPresenter ? TEACHER_TOOLBAR : STUDENT_TOOLBAR;

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialElements, setInitialElements] = useState<
    readonly ExcalidrawElement[] | undefined
  >();
  const [snapshotReady, setSnapshotReady] = useState(false);
  // Derive initial Follow Me state from the toolbar config so the UI toggle
  // and the actual broadcast state agree from the first render.
  const [followMeActive, setFollowMeActive] = useState(() => {
    const item = toolbarItems.find((i) => i.kind === 'action' && i.id === 'follow-me');
    return item?.kind === 'action' ? (item.defaultActive ?? false) : false;
  });
  // Ref so onChange closure always sees latest value without stale captures
  const followMeRef = useRef(followMeActive);
  followMeRef.current = followMeActive;

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
        // Start with a blank board if snapshot load fails
      })
      .finally(() => setSnapshotReady(true));
  }, [onLoadSnapshot]);

  const handleExcalidrawAPI = useCallback((excalidrawApi: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = excalidrawApi;
    setApi(excalidrawApi);
  }, []);

  const applyRemoteElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    excalidrawAPIRef.current?.updateScene({ elements });
  }, []);

  const applyRemoteViewport = useCallback((viewport: ViewportState) => {
    excalidrawAPIRef.current?.updateScene({ appState: viewport });
  }, []);

  const getElements = useCallback(
    () => excalidrawAPIRef.current?.getSceneElements() ?? [],
    [],
  );

  const { broadcastElements, broadcastViewport } = useWhiteboardSync({
    liveSessionId,
    isPresenter,
    supabase,
    onRemoteElements: applyRemoteElements,
    getElements,
    onSaveSnapshot,
    // Students receive viewport syncs; teacher only broadcasts
    onRemoteViewport: !isPresenter ? applyRemoteViewport : undefined,
  });

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      broadcastElements(elements);
      if (isPresenter && followMeRef.current) {
        broadcastViewport({
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
        });
      }
    },
    [broadcastElements, broadcastViewport, isPresenter],
  );

  // Intercept onFollowMeToggle so ClassroomWhiteboard owns the active state,
  // then forward to any external callback the parent passed in.
  const mergedCallbacks: WhiteboardToolbarCallbacks = {
    ...toolbarCallbacks,
    onFollowMeToggle: (active) => {
      setFollowMeActive(active);
      toolbarCallbacks?.onFollowMeToggle?.(active);
    },
  };

  if (!snapshotReady) {
    return (
      <div className="flex h-full min-h-48 w-full items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Loading whiteboard…</p>
      </div>
    );
  }

  return (
    <div className="excalidraw-tutoring relative h-full min-h-48 w-full overflow-hidden rounded-2xl border border-border bg-card">
      <style>{`
        /* ── Hide built-in toolbar & menus ── */
        .excalidraw-tutoring .App-toolbar-container { display: none !important; }
        .excalidraw-tutoring .main-menu-trigger     { display: none !important; }
        .excalidraw-tutoring .App-menu_top          { display: none !important; }

        /* ── Move zoom/undo controls to bottom-right (keep them accessible) ── */
        .excalidraw-tutoring .layer-ui__wrapper__footer-left {
          margin-bottom: 4.5rem;
        }
        .excalidraw-tutoring .layer-ui__wrapper__footer-right {
          margin-bottom: 4.5rem;
        }

        /* ── Hide hint viewer (keyboard shortcut hints) ── */
        .excalidraw-tutoring .HintViewer { display: none !important; }
      `}</style>

      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        initialData={{ elements: initialElements ?? [] }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: !isPresenter ? false : undefined,
            export: { saveFileToDisk: isPresenter },
            toggleTheme: false,
            changeViewBackgroundColor: false,
            clearCanvas: isPresenter,
          },
          tools: { image: false },
        }}
        langCode="en"
      />

      {/* Custom toolbar pinned to the bottom centre */}
      <div className="absolute inset-x-0 bottom-3 z-10 px-4">
        <WhiteboardToolbar items={toolbarItems} api={api} callbacks={mergedCallbacks} />
      </div>
    </div>
  );
}
