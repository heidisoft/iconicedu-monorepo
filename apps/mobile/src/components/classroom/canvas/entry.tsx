import { useClassroomLasers } from './use-classroom-lasers';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  convertToExcalidrawElements,
  restoreElements,
  CaptureUpdateAction,
  exportToBlob,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import { educationalAssets } from '@iconicedu/utils';
import '@excalidraw/excalidraw/index.css';

declare global {
  interface Window {
    ReactNativeWebView: { postMessage(value: string): void };
    classroomAction?: (action: 'export' | 'library') => void;
    classroomScene?: (message: {
      elements: WhiteboardElementVM[];
      editable: boolean;
      dark: boolean;
    }) => void;
  }
}
const send = (value: unknown) =>
  window.ReactNativeWebView.postMessage(JSON.stringify(value));
function Canvas() {
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState('');
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  useClassroomLasers(api);
  const [editable, setEditable] = useState(false);
  const [dark, setDark] = useState(false);
  const observed = useRef(new Map<string, string>());
  const applying = useRef(false);
  const pending = useRef(new Map<string, ExcalidrawElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    window.classroomScene = (message) => {
      if (!api) return;
      applying.current = true;
      setEditable(message.editable);
      setDark(message.dark);
      observed.current = new Map(
        message.elements.map((element) => [
          element.id,
          `${element.version}:${element.nonce}:${element.deleted}`,
        ]),
      );
      api.updateScene({
        elements: restoreElements(
          message.elements.map(
            (element) => element.data,
          ) as unknown as ExcalidrawElement[],
          null,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      applying.current = false;
    };
    if (api) send({ type: 'ready' });
    return () => {
      delete window.classroomScene;
    };
  }, [api]);
  const exportImage = useCallback(async () => {
    if (!api) return;
    try {
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true },
        files: api.getFiles(),
        mimeType: 'image/png',
      });
      const reader = new FileReader();
      reader.onload = () => send({ type: 'export', dataUrl: reader.result });
      reader.onerror = () => send({ type: 'export-error' });
      reader.readAsDataURL(blob);
    } catch {
      send({ type: 'export-error' });
    }
  }, [api]);
  useEffect(() => {
    window.classroomAction = (action) => {
      if (action === 'export') void exportImage();
      else if (action === 'library') setLibrary((previous) => !previous);
    };
    return () => {
      delete window.classroomAction;
    };
  }, [exportImage]);
  return (
    <>
      <Excalidraw
        excalidrawAPI={setApi}
        onPointerUpdate={(event) => {
          if (event.pointer.tool === 'laser')
            send({
              type: 'laser',
              x: event.pointer.x,
              y: event.pointer.y,
              button: event.button,
            });
        }}
        validateEmbeddable={false}
        onPaste={(data) =>
          !(
            data.files ||
            data.mixedContent?.some((part) => part.type === 'imageUrl') ||
            data.elements?.some(
              (element) =>
                ![
                  'rectangle',
                  'frame',
                  'ellipse',
                  'diamond',
                  'line',
                  'arrow',
                  'freedraw',
                  'text',
                ].includes(element.type),
            )
          )
        }
        theme={dark ? 'dark' : 'light'}
        viewModeEnabled={!editable}
        initialData={{ appState: { currentItemFontFamily: 2 } }}
        onChange={(elements) => {
          if (!editable || applying.current) return;
          const changed = elements.filter(
            (element) =>
              observed.current.get(element.id) !==
              `${element.version}:${element.versionNonce}:${element.isDeleted}`,
          );
          if (!changed.length) return;
          for (const element of changed)
            observed.current.set(
              element.id,
              `${element.version}:${element.versionNonce}:${element.isDeleted}`,
            );
          if (!pending.current.size) send({ type: 'drawing' });
          for (const element of changed) pending.current.set(element.id, element);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const changes = [...pending.current.values()];
            pending.current.clear();
            send({
              type: 'elements',
              elements: changes.map((element) => ({
                id: element.id,
                version: element.version,
                nonce: element.versionNonce,
                deleted: element.isDeleted,
                data: { ...element, link: null },
              })),
            });
          }, 200);
        }}
        UIOptions={{
          tools: { image: false },
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
          },
        }}
      />
      {library && (
        <aside
          aria-label="Educational library"
          style={{
            position: 'absolute',
            right: 12,
            top: 64,
            bottom: 12,
            width: 230,
            overflow: 'auto',
            zIndex: 1000,
            background: dark ? '#232329' : '#ffffff',
            color: dark ? '#ffffff' : '#1b1b1f',
            padding: 12,
            borderRadius: 12,
          }}
        >
          <input
            aria-label="Search educational assets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {educationalAssets.search(search).map((asset) => (
            <button
              key={asset.id}
              disabled={!editable}
              style={{ display: 'block', padding: 12, width: '100%' }}
              onClick={() => {
                if (!api) return;
                send({ type: 'drawing' });
                const elements = convertToExcalidrawElements(
                  asset.primitives.map((primitive) =>
                    primitive.type === 'line'
                      ? {
                          type: 'line' as const,
                          x: primitive.x,
                          y: primitive.y,
                          points: primitive.points,
                          strokeColor: primitive.color,
                          strokeWidth: primitive.width ?? 2,
                        }
                      : primitive.type === 'text'
                        ? {
                            type: 'text' as const,
                            x: primitive.x,
                            y: primitive.y,
                            text: primitive.text,
                            fontSize: primitive.size ?? 20,
                            fontFamily: 2,
                          }
                        : {
                            type: 'rectangle' as const,
                            x: primitive.x,
                            y: primitive.y,
                            width: primitive.width,
                            height: primitive.height,
                            strokeColor: primitive.color,
                          },
                  ),
                );
                api.updateScene({
                  elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
                  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                });
                setLibrary(false);
              }}
            >
              {asset.name}
            </button>
          ))}
        </aside>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Canvas />);
