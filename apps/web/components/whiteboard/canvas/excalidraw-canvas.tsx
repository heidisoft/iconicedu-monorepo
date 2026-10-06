'use client';
import { useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import { ExcalidrawWhiteboardEngine, wrapCanvasElements } from './excalidraw-engine';
import type { WhiteboardEngine, WhiteboardTool } from './whiteboard-engine';
import './whiteboard-canvas.css';
import { sceneFingerprint } from './scene-history';

export function ExcalidrawCanvas({
  elements,
  editable,
  onChange,
  onEngine,
  onToolChange,
}: {
  elements: WhiteboardElementVM[];
  editable: boolean;
  onChange: (elements: WhiteboardElementVM[]) => void;
  onEngine: (engine: WhiteboardEngine | null) => void;
  onToolChange: (tool: WhiteboardTool) => void;
}) {
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
    const engine = new ExcalidrawWhiteboardEngine(api, (next) =>
      onChangeRef.current(next),
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
  return (
    <div
      className="classroom-whiteboard-canvas relative min-h-0 flex-1"
      data-testid="whiteboard-canvas"
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
      onPointerDownCapture={() => engineRef.current?.begin()}
      onPointerUpCapture={() => requestAnimationFrame(() => engineRef.current?.commit())}
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
          editable &&
          ['p', 'v', 't'].includes(event.key.toLowerCase()) &&
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
        excalidrawAPI={setApi}
        initialData={{
          appState: {
            viewBackgroundColor: '#ffffff',
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
        onChange={(next) => {
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
    </div>
  );
}
