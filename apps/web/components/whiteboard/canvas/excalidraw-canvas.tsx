'use client';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { CaptureUpdateAction, Excalidraw, restoreElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import { ExcalidrawWhiteboardEngine, wrapCanvasElements } from './excalidraw-engine';
import type { WhiteboardEngine, WhiteboardTool } from './whiteboard-engine';
import './whiteboard-canvas.css';
import { sceneFingerprint } from './scene-history';

export function ExcalidrawCanvas({
  elements,
  editable,
  tool,
  onChange,
  onEngine,
  onToolChange,
}: {
  tool: WhiteboardTool;
  elements: WhiteboardElementVM[];
  editable: boolean;
  onChange: (elements: WhiteboardElementVM[]) => void;
  onEngine: (engine: WhiteboardEngine | null) => void;
  onToolChange: (tool: WhiteboardTool) => void;
}) {
  const gesture = useRef<Array<[number, number]>>([]);
  const [lasso, setLasso] = useState<Array<[number, number]>>([]);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [grid, setGrid] = useState<'none' | 'dots' | 'lines'>('dots');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hasStyleOptions, setHasStyleOptions] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const engineRef = useRef<ExcalidrawWhiteboardEngine | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const currentRef = useRef(elements);
  currentRef.current = elements;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const remoteFingerprint = useRef('');
  useEffect(() => {
    if (!api) return;
    const engine = new ExcalidrawWhiteboardEngine(
      api,
      (next) => onChangeRef.current(next),
      setGrid,
    );
    engineRef.current = engine;
    remoteFingerprint.current = sceneFingerprint(currentRef.current);
    engine.importScene(currentRef.current);
    engine.setEditable(editableRef.current);
    onEngine(engine);
    return () => {
      engine.dispose();
      engineRef.current = null;
      onEngine(null);
    };
  }, [api, onEngine]);
  useEffect(() => {
    const fingerprint = sceneFingerprint(elements);
    if (fingerprint !== sceneFingerprint(engineRef.current?.getElements() ?? [])) {
      remoteFingerprint.current = fingerprint;
      engineRef.current?.importScene(elements);
    }
  }, [elements]);
  useEffect(() => engineRef.current?.setEditable(editable), [editable]);
  useEffect(() => {
    if (!api) return;
    api.updateScene({
      appState: { viewBackgroundColor: 'transparent', theme },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api, theme]);
  return (
    <div
      className="classroom-whiteboard-canvas relative min-h-0 flex-1"
      data-testid="whiteboard-canvas"
      data-grid={grid}
      tabIndex={0}
      aria-label="Drawing canvas"
      onDropCapture={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          event.stopPropagation();
          api?.setToast({
            message: 'File imports are not available on this class whiteboard.',
            closable: true,
          });
        }
      }}
      onPointerDownCapture={(event) => {
        if (
          editable &&
          ['lasso', 'pixel-eraser'].includes(tool) &&
          (event.target as HTMLElement).tagName === 'CANVAS'
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          const box = event.currentTarget.getBoundingClientRect(),
            state = api?.getAppState();
          if (!state) return;
          gesture.current = [
            [
              (event.clientX - box.left) / state.zoom.value - state.scrollX,
              (event.clientY - box.top) / state.zoom.value - state.scrollY,
            ],
          ];
          engineRef.current?.begin();
          if (tool === 'pixel-eraser')
            engineRef.current?.erasePixels(gesture.current[0], 10 / state.zoom.value);
          else setLasso([[event.clientX - box.left, event.clientY - box.top]]);
        } else engineRef.current?.begin();
      }}
      onPointerMoveCapture={(event) => {
        if (
          !gesture.current.length ||
          !editable ||
          !['lasso', 'pixel-eraser'].includes(tool)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect(),
          state = api?.getAppState();
        if (!state) return;
        const point: [number, number] = [
          (event.clientX - box.left) / state.zoom.value - state.scrollX,
          (event.clientY - box.top) / state.zoom.value - state.scrollY,
        ];
        gesture.current.push(point);
        if (tool === 'pixel-eraser')
          engineRef.current?.erasePixels(point, 10 / state.zoom.value);
        else
          setLasso((previous) => [
            ...previous,
            [event.clientX - box.left, event.clientY - box.top],
          ]);
      }}
      onPointerUpCapture={(event) => {
        if (gesture.current.length) {
          event.preventDefault();
          event.stopPropagation();
          if (tool === 'lasso') engineRef.current?.selectLasso(gesture.current);
          gesture.current = [];
          setLasso([]);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        requestAnimationFrame(() => engineRef.current?.commit());
      }}
      onPointerCancelCapture={() => {
        gesture.current = [];
        setLasso([]);
        engineRef.current?.commit();
      }}
      onKeyDownCapture={(event) => {
        if (
          (event.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')
        )
          return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.stopPropagation();
          if (editable) {
            if (event.shiftKey) engineRef.current?.redo();
            else engineRef.current?.undo();
          }
        } else if (editable && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault();
          event.stopPropagation();
          engineRef.current?.deleteSelection();
        } else if (
          (editable || event.key.toLowerCase() === 'h') &&
          ['p', 'v', 't', 'h'].includes(event.key.toLowerCase()) &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          event.stopPropagation();
          const nextTool =
            event.key.toLowerCase() === 'p'
              ? 'freedraw'
              : event.key.toLowerCase() === 'v'
                ? 'selection'
                : event.key.toLowerCase() === 'h'
                  ? 'hand'
                  : 'text';
          engineRef.current?.setTool(nextTool);
          onToolChange(nextTool);
        } else if (['+', '=', '-'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          engineRef.current?.zoomBy(event.key === '-' ? -0.1 : 0.1);
        }
      }}
    >
      <Excalidraw
        theme={theme}
        excalidrawAPI={setApi}
        initialData={{
          elements: restoreElements(
            elements.map((element) => element.data) as unknown as ExcalidrawElement[],
            null,
          ),
          appState: {
            viewBackgroundColor: 'transparent',
            currentItemRoughness: 0,
            currentItemFontFamily: 2,
            currentItemStrokeWidth: 2,
            currentItemFillStyle: 'solid',
          },
        }}
        validateEmbeddable={false}
        onPaste={(data) => {
          if (
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
          ) {
            api?.setToast({
              message:
                'Paste text or drawing elements. Images and embedded content are not supported.',
              closable: true,
            });
            return false;
          }
          return true;
        }}
        viewModeEnabled={!editable}
        handleKeyboardGlobally={false}
        autoFocus={false}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            export: false,
            clearCanvas: false,
            changeViewBackgroundColor: false,
            toggleTheme: false,
          },
        }}
        onChange={(next, state) => {
          setOptionsOpen(state.openMenu === 'shape');
          setHasStyleOptions(
            !['hand', 'eraser', 'laser'].includes(state.activeTool.type) &&
              (state.activeTool.type !== 'selection' ||
                Object.keys(state.selectedElementIds).length > 0),
          );
          if (!engineRef.current) return;
          const wrapped = wrapCanvasElements(next);
          const fingerprint = sceneFingerprint(wrapped);
          if (fingerprint === remoteFingerprint.current) return;
          remoteFingerprint.current = fingerprint;
          if (editableRef.current) {
            engineRef.current?.observe(wrapped);
            onChangeRef.current(wrapped);
          }
        }}
        onPointerUp={() => requestAnimationFrame(() => engineRef.current?.commit())}
      />
      {lasso.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          aria-hidden="true"
        >
          <polygon
            points={lasso.map((p) => p.join(',')).join(' ')}
            fill="var(--primary)"
            fillOpacity="0.08"
            stroke="var(--primary)"
            strokeDasharray="5 4"
          />
        </svg>
      )}
      {editable && hasStyleOptions && (
        <button
          type="button"
          className="whiteboard-style-toggle absolute bottom-3 right-3 z-40 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs text-foreground shadow-sm"
          aria-expanded={optionsOpen}
          onClick={() =>
            api?.updateScene({ appState: { openMenu: optionsOpen ? null : 'shape' } })
          }
        >
          {optionsOpen ? 'Hide tool options' : 'Show tool options'}
        </button>
      )}
    </div>
  );
}
