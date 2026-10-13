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
import { useWhiteboardLaser } from './use-whiteboard-laser';
import { DrawingStyleStrip } from '@iconicedu/ui-web/ui/drawing-style-strip';
import { sceneFingerprint } from './scene-history';

export function ExcalidrawCanvas({
  elements,
  token,
  defaultColor,
  editable,
  tool,
  onChange,
  onEngine,
  onToolChange,
}: {
  token?: string;
  defaultColor?: string;
  tool: WhiteboardTool;
  elements: WhiteboardElementVM[];
  editable: boolean;
  onChange: (elements: WhiteboardElementVM[]) => void;
  onEngine: (engine: WhiteboardEngine | null) => void;
  onToolChange: (tool: WhiteboardTool) => void;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [grid, setGrid] = useState<'none' | 'dots' | 'lines'>('dots');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [quickStyle, setQuickStyle] = useState({
    color: '#1e293b',
    width: 2,
    fill: 'transparent',
    type: 'selection',
  });
  const [hasStyleOptions, setHasStyleOptions] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const onPointerUpdate = useWhiteboardLaser(api, token);
  const engineRef = useRef<ExcalidrawWhiteboardEngine | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const currentRef = useRef(elements);
  currentRef.current = elements;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const remoteFingerprint = useRef('');
  const previousStyleColor = useRef('');
  const previousDefaultColor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!api || !defaultColor) return;
    const previous = previousDefaultColor.current;
    if (!previous || api.getAppState().currentItemStrokeColor === previous) {
      api.updateScene({
        appState: { currentItemStrokeColor: defaultColor },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
    previousDefaultColor.current = defaultColor;
  }, [api, defaultColor]);
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
  useEffect(() => setOptionsOpen(false), [tool, editable]);
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
      data-recording-whiteboard
      data-testid="whiteboard-canvas"
      data-grid={grid}
      data-style-options={optionsOpen}
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
        if ((event.target as HTMLElement).closest('.whiteboard-quick-styles')) return;
        if (
          !(event.target as HTMLElement).closest(
            '.selected-shape-actions,.App-mobile-menu',
          )
        )
          setOptionsOpen(false);
        engineRef.current?.begin();
      }}
      onPointerUpCapture={() => requestAnimationFrame(() => engineRef.current?.commit())}
      onPointerCancelCapture={() => engineRef.current?.commit()}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') setOptionsOpen(false);
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
        onPointerUpdate={onPointerUpdate}
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
          const selected = next.find(
            (element) => !element.isDeleted && state.selectedElementIds[element.id],
          );
          const color = selected?.strokeColor ?? state.currentItemStrokeColor;
          if (previousStyleColor.current && previousStyleColor.current !== color)
            setOptionsOpen(false);
          previousStyleColor.current = color;
          setQuickStyle((previous) => {
            const value = {
              color,
              width: selected?.strokeWidth ?? state.currentItemStrokeWidth,
              fill: selected?.backgroundColor ?? state.currentItemBackgroundColor,
              type: selected?.type ?? state.activeTool.type,
            };
            return JSON.stringify(previous) === JSON.stringify(value) ? previous : value;
          });
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
      {editable && hasStyleOptions && (
        <DrawingStyleStrip
          className="whiteboard-quick-styles absolute left-3 z-40"
          {...{ optionsOpen }}
          color={quickStyle.color}
          width={quickStyle.width}
          fill={quickStyle.fill}
          showWidth={quickStyle.type !== 'text'}
          showFill={['rectangle', 'ellipse', 'diamond'].includes(quickStyle.type)}
          onStyle={(style) => {
            engineRef.current?.setQuickStyle(style);
            setOptionsOpen(false);
          }}
          onMore={() => {
            setOptionsOpen(!optionsOpen);
            api?.updateScene({ appState: { openMenu: optionsOpen ? null : 'shape' } });
          }}
        />
      )}
    </div>
  );
}
