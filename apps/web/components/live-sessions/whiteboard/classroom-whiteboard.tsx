'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import '@excalidraw/excalidraw/index.css';

import { useWhiteboardSync } from '@iconicedu/web/components/live-sessions/whiteboard/use-whiteboard-sync';

export interface ClassroomWhiteboardProps {
  liveSessionId: string;
  isPresenter: boolean;
  supabase: SupabaseClient;
  onLoadSnapshot?: () => Promise<Record<string, unknown> | null>;
  onSaveSnapshot?: (elements: readonly ExcalidrawElement[]) => Promise<void>;
}

export function ClassroomWhiteboard({
  liveSessionId,
  isPresenter,
  supabase,
  onLoadSnapshot,
  onSaveSnapshot,
}: ClassroomWhiteboardProps) {
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initialElements, setInitialElements] = useState<
    readonly ExcalidrawElement[] | undefined
  >();
  const [snapshotReady, setSnapshotReady] = useState(false);

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

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = api;
  }, []);

  const applyRemoteElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    excalidrawAPIRef.current?.updateScene({ elements });
  }, []);

  const getElements = useCallback(
    () => excalidrawAPIRef.current?.getSceneElements() ?? [],
    [],
  );

  const { broadcastElements } = useWhiteboardSync({
    liveSessionId,
    isPresenter,
    supabase,
    onRemoteElements: applyRemoteElements,
    getElements,
    onSaveSnapshot,
  });

  if (!snapshotReady) {
    return (
      <div className="flex h-full min-h-48 w-full items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Loading whiteboard…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-48 w-full overflow-hidden rounded-2xl border border-border bg-card">
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        initialData={{ elements: initialElements ?? [] }}
        onChange={(elements) => broadcastElements(elements)}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: !isPresenter ? false : undefined,
            export: { saveFileToDisk: isPresenter },
            toggleTheme: true,
          },
        }}
        langCode="en"
      />
    </div>
  );
}
