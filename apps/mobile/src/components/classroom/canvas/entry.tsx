import { useClassroomLasers } from './use-classroom-lasers';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  convertToExcalidrawElements,
  restoreElements,
  CaptureUpdateAction,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { WhiteboardViewportVM, WhiteboardElementVM } from '@iconicedu/shared-types';
import {
  SceneHistory,
  sceneFingerprint,
  educationalAssets,
  resolveWhiteboardFollow,
  animateWhiteboardFollow,
} from '@iconicedu/utils';
import '@excalidraw/excalidraw/index.css';

declare global {
  interface Window {
    ReactNativeWebView: { postMessage(value: string): void };
    classroomCommand?: (command: {
      type: string;
      tool?: string;
      grid?: string;
      snap?: boolean;
      delta?: number;
      style?: { strokeColor?: string; strokeWidth?: number; backgroundColor?: string };
    }) => void;
    classroomViewport?: (
      viewport: WhiteboardViewportVM,
      sourceKey?: string | null,
    ) => void;
    classroomCancelFollow?: () => void;
    classroomAction?: (action: 'export' | 'export-svg' | 'library') => void;
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
  const [styleOptions, setStyleOptions] = useState(false);
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState('');
  const centered = useRef(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  useClassroomLasers(api);
  const [editable, setEditable] = useState(false);
  const [dark, setDark] = useState(false);
  const lastStyle = useRef('');
  const lastViewport = useRef('');
  const interacting = useRef(false);
  const previousSource = useRef<string | null | undefined>(undefined);
  const previousViewport = useRef<WhiteboardViewportVM | undefined>(undefined);
  const writing = useRef<{ x: number; y: number } | undefined>(undefined);
  const writingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelFollow = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      cancelFollow.current();
      if (writingTimer.current) clearTimeout(writingTimer.current);
    },
    [],
  );
  const history = useRef(new SceneHistory());
  const replaying = useRef(false);
  const historyScene = useRef<WhiteboardElementVM[]>([]);
  const [grid, setGrid] = useState('dots');
  const observed = useRef(new Map<string, string>());
  const importedFingerprint = useRef('');
  const applying = useRef(false);
  const pending = useRef(new Map<string, ExcalidrawElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultToolApplied = useRef(false);
  useEffect(() => {
    if (!api || !editable || defaultToolApplied.current) return;
    defaultToolApplied.current = true;
    api.setActiveTool({ type: 'laser' });
  }, [api, editable]);
  useEffect(() => {
    window.classroomCancelFollow = () => {
      cancelFollow.current();
      previousViewport.current = undefined;
      previousSource.current = undefined;
    };
    window.classroomViewport = (viewport, sourceKey) => {
      if (!api) return;
      const state = api.getAppState();
      if (interacting.current || state.editingTextElement) return;
      cancelFollow.current();
      if (previousSource.current !== sourceKey) previousViewport.current = undefined;
      previousSource.current = sourceKey;
      const from = {
        centerX: state.width / (2 * state.zoom.value) - state.scrollX,
        centerY: state.height / (2 * state.zoom.value) - state.scrollY,
        zoom: state.zoom.value,
      };
      const to = resolveWhiteboardFollow(from, viewport, previousViewport.current, state);
      previousViewport.current = viewport;
      cancelFollow.current = animateWhiteboardFollow(
        from,
        to,
        (next) =>
          api.updateScene({
            appState: {
              scrollX: state.width / (2 * next.zoom) - next.centerX,
              scrollY: state.height / (2 * next.zoom) - next.centerY,
              zoom: { value: next.zoom as typeof state.zoom.value },
            },
            captureUpdate: CaptureUpdateAction.NEVER,
          }),
        {
          request: (callback) => requestAnimationFrame(callback),
          cancel: (id) => cancelAnimationFrame(id),
          blocked: () => interacting.current || !!api.getAppState().editingTextElement,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        },
      );
    };
    window.classroomScene = (message) => {
      if (!api) return;
      applying.current = true;
      setEditable(message.editable);
      setDark(message.dark);
      historyScene.current = message.elements;
      observed.current = new Map(
        message.elements.map((element) => [
          element.id,
          `${element.version}:${element.nonce}:${element.deleted}`,
        ]),
      );
      const fingerprint = sceneFingerprint(message.elements);
      if (fingerprint !== importedFingerprint.current)
        api.updateScene({
          elements: restoreElements(
            message.elements.map(
              (element) => element.data,
            ) as unknown as ExcalidrawElement[],
            null,
          ),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      importedFingerprint.current = fingerprint;
      if (api.getAppState().viewBackgroundColor !== 'transparent')
        api.updateScene({
          appState: { viewBackgroundColor: 'transparent' },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      if (!centered.current) {
        centered.current = true;
        const elements = api.getSceneElements();
        if (elements.length)
          api.scrollToContent(elements, {
            fitToContent: true,
            animate: false,
            maxZoom: 1,
          });
        else {
          const state = api.getAppState();
          api.updateScene({
            appState: {
              scrollX: state.width / (2 * state.zoom.value),
              scrollY: state.height / (2 * state.zoom.value),
            },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      }
      applying.current = false;
    };
    if (api) send({ type: 'ready' });
    return () => {
      delete window.classroomScene;
      delete window.classroomViewport;
      delete window.classroomCancelFollow;
    };
  }, [api]);
  const exportImage = useCallback(
    async (format: 'png' | 'svg' = 'png') => {
      if (!api) return;
      try {
        if (format === 'svg') {
          const svg = await exportToSvg({
            elements: api.getSceneElements(),
            appState: { ...api.getAppState(), exportBackground: true },
            files: api.getFiles(),
          });
          send({ type: 'export-svg', svg: new XMLSerializer().serializeToString(svg) });
          return;
        }
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
    },
    [api],
  );
  useEffect(() => {
    window.classroomCommand = (command) => {
      if (!api) return;
      const state = api.getAppState();
      if (command.type === 'tool') {
        if (!editable && command.tool !== 'hand') return;
        const type = command.tool as
          | 'hand'
          | 'laser'
          | 'selection'
          | 'freedraw'
          | 'text'
          | 'eraser'
          | 'line'
          | 'arrow'
          | 'rectangle'
          | 'ellipse'
          | 'diamond'
          | 'frame';
        setStyleOptions(false);
        api.setActiveTool({ type });
        api.updateScene({ appState: { openMenu: null } });
      } else if (command.type === 'library') setLibrary((value) => !value);
      else if (command.type === 'fit')
        api.scrollToContent(undefined, { fitToContent: true });
      else if (command.type === 'grid') {
        setGrid(command.grid ?? 'dots');
        api.updateScene({
          appState: { gridSize: 24, gridModeEnabled: command.snap === true },
        });
      } else if (command.type === 'zoom' || command.type === 'reset-zoom') {
        const zoom =
          command.type === 'reset-zoom'
            ? 1
            : Math.max(0.1, Math.min(4, state.zoom.value + (command.delta ?? 0)));
        api.updateScene({
          appState: { zoom: { value: zoom as typeof state.zoom.value } },
        });
      } else if ((command.type === 'undo' || command.type === 'redo') && editable) {
        const scene = history.current[command.type](historyScene.current);
        if (sceneFingerprint(scene) === sceneFingerprint(historyScene.current)) return;
        replaying.current = true;
        api.updateScene({
          elements: restoreElements(
            scene.map((element) => element.data) as unknown as ExcalidrawElement[],
            null,
          ),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        // History changes have new element versions and use the same save pipeline as strokes.
      } else if (command.type === 'style' && editable && command.style) {
        setStyleOptions(false);
        const style = command.style;
        api.updateScene({
          appState: {
            currentItemStrokeColor: style.strokeColor ?? state.currentItemStrokeColor,
            currentItemStrokeWidth: style.strokeWidth ?? state.currentItemStrokeWidth,
            currentItemBackgroundColor:
              style.backgroundColor ?? state.currentItemBackgroundColor,
          },
          elements: api.getSceneElementsIncludingDeleted().map((element) =>
            state.selectedElementIds[element.id]
              ? {
                  ...element,
                  ...style,
                  version: element.version + 1,
                  versionNonce: Math.floor(Math.random() * 0x7fffffff),
                }
              : element,
          ),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } else if (command.type === 'close-style-options') {
        setStyleOptions(false);
        api.updateScene({ appState: { openMenu: null } });
      } else if (command.type === 'style-options') {
        setStyleOptions((value) => !value);
        api.updateScene({
          appState: { openMenu: 'shape' },
        });
      }
    };
    window.classroomAction = (action) => {
      if (action === 'export') void exportImage();
      else if (action === 'export-svg') void exportImage('svg');
      else if (action === 'library') setLibrary((previous) => !previous);
    };
    return () => {
      delete window.classroomAction;
      delete window.classroomCommand;
    };
  }, [exportImage, api, editable]);
  return (
    <div
      className="native-classroom-canvas"
      onPointerDownCapture={() => {
        interacting.current = true;
        cancelFollow.current();
      }}
      onPointerUpCapture={() => {
        interacting.current = false;
      }}
      onPointerCancelCapture={() => {
        interacting.current = false;
      }}
      data-grid={grid}
      data-style-options={styleOptions}
      style={{
        position: 'relative',
        height: '100%',
        backgroundColor: dark ? '#232329' : '#fff',
        color: dark ? '#eee' : '#333',
      }}
    >
      <style>{`
        .native-classroom-canvas .App-toolbar,.native-classroom-canvas .App-menu_bottom,.native-classroom-canvas .layer-ui__wrapper__top-right,.native-classroom-canvas .HelpButton,.native-classroom-canvas .sidebar-trigger,.native-classroom-canvas .welcome-screen,.native-classroom-canvas .App-menu_top__left > :not(.selected-shape-actions),.native-classroom-canvas .shapes-section,.native-classroom-canvas .App-top-bar { display:none!important; }
        .native-classroom-canvas .excalidraw { background:transparent; }
        .native-classroom-canvas[data-style-options="true"] .selected-shape-actions { margin-top:120px!important; max-height:calc(100vh - 200px); overflow-y:auto; }
        .native-classroom-canvas[data-style-options="true"] .App-mobile-menu { top:132px!important; max-height:calc(100vh - 200px); overflow-y:auto; }
        .native-classroom-canvas[data-style-options="false"] .selected-shape-actions,.native-classroom-canvas[data-style-options="false"] .App-mobile-menu { display:none!important; }
        .native-classroom-canvas[data-grid="dots"] { background-image:radial-gradient(circle,#8884 1px, transparent 1px);background-size:24px 24px; }
        .native-classroom-canvas[data-grid="lines"] { background-image:linear-gradient(to right,#8882 1px,transparent 1px),linear-gradient(to bottom,#8882 1px,transparent 1px);background-size:24px 24px; }
      `}</style>
      <Excalidraw
        excalidrawAPI={setApi}
        onPointerUpdate={(event) => {
          if (
            api &&
            editable &&
            event.button === 'down' &&
            [
              'freedraw',
              'text',
              'line',
              'arrow',
              'rectangle',
              'ellipse',
              'diamond',
              'frame',
            ].includes(api.getAppState().activeTool.type)
          ) {
            writing.current = { x: event.pointer.x, y: event.pointer.y };
            const publish = () => {
              const state = api.getAppState();
              send({
                type: 'viewport',
                viewport: {
                  centerX: state.width / (2 * state.zoom.value) - state.scrollX,
                  centerY: state.height / (2 * state.zoom.value) - state.scrollY,
                  zoom: state.zoom.value,
                  ...(writing.current ? { writing: writing.current } : {}),
                },
              });
            };
            publish();
            if (writingTimer.current) clearTimeout(writingTimer.current);
            writingTimer.current = setTimeout(() => {
              writing.current = undefined;
              publish();
            }, 1500);
          }
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
        initialData={{
          appState: { currentItemFontFamily: 2, viewBackgroundColor: 'transparent' },
        }}
        onChange={(elements, state) => {
          const viewport = {
            centerX: state.width / (2 * state.zoom.value) - state.scrollX,
            centerY: state.height / (2 * state.zoom.value) - state.scrollY,
            zoom: state.zoom.value,
            ...(writing.current ? { writing: writing.current } : {}),
          };
          const key = JSON.stringify(viewport);
          if (key !== lastViewport.current) {
            lastViewport.current = key;
            send({ type: 'viewport', viewport });
          }
          const selected = elements.find(
            (element) => state.selectedElementIds[element.id] && !element.isDeleted,
          );
          const styleState = {
            type: 'tool-state',
            selectionType: selected?.type,
            tool: state.activeTool.type,
            color: selected?.strokeColor ?? state.currentItemStrokeColor,
            width: selected?.strokeWidth ?? state.currentItemStrokeWidth,
            fill: selected?.backgroundColor ?? state.currentItemBackgroundColor,
          };
          const styleKey = JSON.stringify(styleState);
          if (styleKey !== lastStyle.current) {
            lastStyle.current = styleKey;
            send(styleState);
          }
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
            const wrapped = changes.map((element) => ({
              id: element.id,
              version: element.version,
              nonce: element.versionNonce,
              deleted: element.isDeleted,
              data: { ...element, link: null },
            }));
            if (!replaying.current) history.current.record(historyScene.current, wrapped);
            replaying.current = false;
            const scene = new Map(
              historyScene.current.map((element) => [element.id, element]),
            );
            for (const element of wrapped) scene.set(element.id, element);
            historyScene.current = [...scene.values()];
            importedFingerprint.current = sceneFingerprint(historyScene.current);
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
          <h3>Educational library</h3>
          {educationalAssets.categories().map((category) => (
            <section key={category} aria-label={category}>
              <h4>{category}</h4>
              {educationalAssets.search(search, category).map((asset) => (
                <button
                  key={asset.id}
                  disabled={!editable}
                  style={{ display: 'block', padding: 12, width: '100%' }}
                  onClick={() => {
                    if (!api) return;
                    send({ type: 'drawing' });
                    const state = api.getAppState();
                    const offsetX =
                      state.width / (2 * state.zoom.value) -
                      state.scrollX -
                      asset.width / 2;
                    const offsetY =
                      state.height / (2 * state.zoom.value) -
                      state.scrollY -
                      asset.height / 2;
                    const elements = convertToExcalidrawElements(
                      asset.primitives.map((primitive) =>
                        primitive.type === 'line'
                          ? {
                              type: 'line' as const,
                              x: offsetX + primitive.x,
                              y: offsetY + primitive.y,
                              points: primitive.points,
                              strokeColor: primitive.color,
                              strokeWidth: primitive.width ?? 2,
                            }
                          : primitive.type === 'text'
                            ? {
                                type: 'text' as const,
                                x: offsetX + primitive.x,
                                y: offsetY + primitive.y,
                                text: primitive.text,
                                fontSize: primitive.size ?? 20,
                                fontFamily: 2,
                              }
                            : {
                                type: 'rectangle' as const,
                                x: offsetX + primitive.x,
                                y: offsetY + primitive.y,
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
            </section>
          ))}
          {!educationalAssets.search(search).length && (
            <p role="status">No matching assets</p>
          )}
        </aside>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Canvas />);
