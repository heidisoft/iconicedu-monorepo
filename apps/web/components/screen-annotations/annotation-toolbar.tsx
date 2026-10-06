'use client';
import { useEffect, useRef, useState } from 'react';
import type { AnnotationTool } from '@iconicedu/shared-types';
export const annotationTools: { tool: AnnotationTool; label: string }[] = [
  { tool: 'cursor', label: 'Pointer' },
  { tool: 'select', label: 'Select' },
  { tool: 'pen', label: 'Pen' },
  { tool: 'highlighter', label: 'Highlighter' },
  { tool: 'line', label: 'Line' },
  { tool: 'arrow', label: 'Arrow' },
  { tool: 'doubleArrow', label: 'Double arrow' },
  { tool: 'rectangle', label: 'Rectangle' },
  { tool: 'rectangleFilled', label: 'Filled rectangle' },
  { tool: 'rectangleHighlight', label: 'Rectangle highlight' },
  { tool: 'ellipse', label: 'Ellipse' },
  { tool: 'ellipseFilled', label: 'Filled ellipse' },
  { tool: 'ellipseHighlight', label: 'Ellipse highlight' },
  { tool: 'diamond', label: 'Diamond' },
  { tool: 'vanishingPen', label: 'Vanishing pen' },
  { tool: 'spotlight', label: 'Spotlight' },
  { tool: 'pointerArrow', label: 'Named pointer' },
  { tool: 'stampCheck', label: '✓ Check' },
  { tool: 'stampX', label: '✕ Cross' },
  { tool: 'stampStar', label: '★ Star' },
  { tool: 'stampHeart', label: '♥ Heart' },
  { tool: 'stampQuestion', label: '? Question' },
  { tool: 'stampArrow', label: '➜ Stamp arrow' },
];
export function AnnotationToolbar({
  tool,
  setTool,
  canDraw,
  tutor,
  studentsEnabled,
  onPermissions,
  undo,
  redo,
  undoCount,
  redoCount,
  clear,
  color,
  setColor,
  width,
  setWidth,
  opacity,
  setOpacity,
  fontSize,
  setFontSize,
  bold,
  setBold,
  italic,
  setItalic,
  onFormat,
  onDuplicate,
  onDelete,
  onSave,
  showNames,
  setShowNames,
  pressure,
  setPressure,
}: {
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;
  canDraw: boolean;
  tutor: boolean;
  studentsEnabled: boolean;
  onPermissions: (enabled: boolean) => void;
  undo: () => void;
  redo: () => void;
  undoCount: number;
  redoCount: number;
  clear: (scope: 'mine' | 'students' | 'all') => void;
  color: string;
  setColor: (value: string) => void;
  width: number;
  setWidth: (value: number) => void;
  opacity: number;
  setOpacity: (value: number) => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  bold: boolean;
  setBold: (value: boolean) => void;
  italic: boolean;
  setItalic: (value: boolean) => void;
  onFormat: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
  showNames: boolean;
  setShowNames: (value: boolean) => void;
  pressure: boolean;
  setPressure: (value: boolean) => void;
}) {
  const [dock, setDock] = useState('bottom');
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('annotation-toolbar') ?? 'null');
      if (
        saved &&
        ['top', 'bottom', 'left', 'right', 'floating'].includes(saved.dock) &&
        Number.isFinite(saved.position?.x) &&
        Number.isFinite(saved.position?.y)
      ) {
        setDock(saved.dock);
        setPosition(saved.position);
      }
    } catch {
      /* Browser storage is optional. */
    }
  }, []);
  const persist = (nextDock: string, nextPosition = position) => {
    setDock(nextDock);
    setPosition(nextPosition);
    try {
      localStorage.setItem(
        'annotation-toolbar',
        JSON.stringify({ dock: nextDock, position: nextPosition }),
      );
    } catch {
      /* Browser storage is optional. */
    }
  };
  const popoverSide = dock === 'bottom' ? 'bottom-full' : 'top-full';
  const button = 'min-h-11 rounded-md px-2 text-xs hover:bg-accent disabled:opacity-40';
  return (
    <div
      role="toolbar"
      aria-label="Screen annotations"
      className={`absolute z-30 flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-background/95 p-2 text-foreground shadow-lg ring-1 ring-border ${dock === 'top' ? 'left-2 right-2 top-2' : dock === 'bottom' ? 'bottom-2 left-2 right-2' : dock === 'left' ? 'bottom-2 left-2 top-2 w-36 overflow-y-auto' : dock === 'right' ? 'bottom-2 right-2 top-2 w-36 overflow-y-auto' : ''}`}
      style={
        dock === 'floating'
          ? { left: position.x, top: position.y, maxWidth: 'calc(100% - 32px)' }
          : undefined
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`${button} touch-none`}
        aria-label="Drag annotation toolbar"
        onPointerDown={(event) => {
          const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
          const parent =
            event.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: bounds.left - parent.left,
            top: bounds.top - parent.top,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) {
            setDock('floating');
            setPosition({
              x: Math.max(0, drag.current.left + event.clientX - drag.current.x),
              y: Math.max(0, drag.current.top + event.clientY - drag.current.y),
            });
          }
        }}
        onPointerUp={(event) => {
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          persist('floating');
        }}
      >
        ⠿
      </button>
      {(['cursor', 'pen', 'highlighter', 'text', 'eraser'] as AnnotationTool[]).map(
        (item) => (
          <button
            type="button"
            key={item}
            className={button}
            aria-pressed={tool === item}
            disabled={!canDraw && item !== 'cursor'}
            onClick={() => setTool(item)}
          >
            {item === 'cursor' ? 'Pointer' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ),
      )}
      <select
        aria-label="Shapes and advanced tools"
        className="min-h-11 max-w-36 rounded-md bg-background px-2 text-xs"
        value={annotationTools.some((item) => item.tool === tool) ? tool : 'cursor'}
        disabled={!canDraw}
        onChange={(event) => setTool(event.target.value as AnnotationTool)}
      >
        {annotationTools.map((item) => (
          <option key={item.tool} value={item.tool}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={button}
        disabled={!canDraw || !undoCount}
        onClick={undo}
      >
        Undo
      </button>
      <button
        type="button"
        className={button}
        disabled={!canDraw || !redoCount}
        onClick={redo}
      >
        Redo
      </button>
      <details className="relative">
        <summary className={`${button} cursor-pointer py-3`}>Format</summary>
        <div
          className={`absolute ${popoverSide} right-0 z-40 grid w-56 gap-2 rounded-lg bg-background p-3 shadow-xl ring-1 ring-border`}
        >
          <label className="flex items-center justify-between text-xs">
            Color
            <input
              aria-label="Annotation color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {[
              '#000000',
              '#ef4444',
              '#f97316',
              '#facc15',
              '#22c55e',
              '#3b82f6',
              '#a855f7',
              '#ffffff',
            ].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Color ${value}`}
                className="size-11 rounded-md border"
                style={{ backgroundColor: value }}
                onClick={() => setColor(value)}
              />
            ))}
          </div>
          <label className="text-xs">
            Width
            <select
              aria-label="Stroke width"
              className="ml-2 min-h-11 bg-background"
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            >
              <option value={1}>Thin</option>
              <option value={3}>Medium</option>
              <option value={6}>Thick</option>
              <option value={18}>Wide</option>
            </select>
          </label>
          <label className="text-xs">
            Opacity
            <input
              aria-label="Annotation opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
          <label className="text-xs">
            Text size
            <input
              aria-label="Text size"
              type="number"
              min={8}
              max={96}
              value={fontSize}
              onChange={(event) =>
                setFontSize(Math.max(8, Math.min(96, Number(event.target.value))))
              }
            />
          </label>
          <label className="text-xs">
            <input
              type="checkbox"
              checked={bold}
              onChange={(event) => setBold(event.target.checked)}
            />{' '}
            Bold
          </label>
          <label className="text-xs">
            <input
              type="checkbox"
              checked={italic}
              onChange={(event) => setItalic(event.target.checked)}
            />{' '}
            Italic
          </label>
          <label className="text-xs">
            <input
              type="checkbox"
              checked={pressure}
              onChange={(event) => setPressure(event.target.checked)}
            />{' '}
            Pressure sensitive pen
          </label>
          <button type="button" className={button} disabled={!canDraw} onClick={onFormat}>
            Apply to selected
          </button>
        </div>
      </details>
      <details className="relative">
        <summary className={`${button} cursor-pointer py-3`}>More</summary>
        <div
          className={`absolute ${popoverSide} right-0 z-40 grid w-56 gap-1 rounded-lg bg-background p-2 shadow-xl ring-1 ring-border`}
        >
          <button
            type="button"
            className={button}
            disabled={!canDraw}
            onClick={() => clear('mine')}
          >
            Clear mine
          </button>
          {tutor && (
            <>
              <button type="button" className={button} onClick={() => clear('students')}>
                Clear students
              </button>
              <button type="button" className={button} onClick={() => clear('all')}>
                Clear all
              </button>
              <label className="p-2 text-xs">
                <input
                  type="checkbox"
                  checked={studentsEnabled}
                  onChange={(event) => onPermissions(event.target.checked)}
                />{' '}
                Allow students to annotate
              </label>
            </>
          )}
          <button
            type="button"
            className={button}
            disabled={!canDraw}
            onClick={onDuplicate}
          >
            Duplicate selected
          </button>
          <button type="button" className={button} disabled={!canDraw} onClick={onDelete}>
            Delete selected
          </button>
          <button type="button" className={button} onClick={onSave}>
            Save PNG
          </button>
          <label className="p-2 text-xs">
            <input
              type="checkbox"
              checked={showNames}
              onChange={(event) => setShowNames(event.target.checked)}
            />{' '}
            Show annotator names
          </label>
          <select
            aria-label="Toolbar position"
            className="min-h-11 bg-background"
            value={dock}
            onChange={(event) => persist(event.target.value)}
          >
            {['top', 'bottom', 'left', 'right', 'floating'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}
