'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Copy,
  Diamond,
  Ellipsis,
  Eraser,
  GripVertical,
  Heart,
  Highlighter,
  LocateFixed,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Redo2,
  Scan,
  Sparkles,
  Square,
  Star,
  Stamp,
  Type,
  Undo2,
  X,
  CircleHelp,
  Palette,
  Download,
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AnnotationTool } from '@iconicedu/shared-types';
const tools = {
  cursor: { label: 'Pointer', icon: MousePointer2, shortcut: '' },
  select: { label: 'Select', icon: Scan, shortcut: 'V' },
  pen: { label: 'Pen', icon: Pencil, shortcut: 'P' },
  highlighter: { label: 'Highlighter', icon: Highlighter, shortcut: 'H' },
  text: { label: 'Text', icon: Type, shortcut: 'T' },
  eraser: { label: 'Eraser', icon: Eraser, shortcut: 'E' },
  line: { label: 'Line', icon: Minus },
  arrow: { label: 'Arrow', icon: ArrowRight },
  doubleArrow: { label: 'Double arrow', icon: ArrowLeftRight },
  rectangle: { label: 'Rectangle', icon: Square },
  rectangleFilled: { label: 'Filled rectangle', icon: Square, filled: true },
  rectangleHighlight: { label: 'Rectangle highlight', icon: Square, highlight: true },
  ellipse: { label: 'Ellipse', icon: Circle },
  ellipseFilled: { label: 'Filled ellipse', icon: Circle, filled: true },
  ellipseHighlight: { label: 'Ellipse highlight', icon: Circle, highlight: true },
  diamond: { label: 'Diamond', icon: Diamond },
  vanishingPen: { label: 'Vanishing pen', icon: Sparkles },
  spotlight: { label: 'Spotlight', icon: LocateFixed },
  pointerArrow: { label: 'Named pointer', icon: MoveUpRight },
  stampCheck: { label: 'Check', icon: Check },
  stampX: { label: 'Cross', icon: X },
  stampStar: { label: 'Star', icon: Star },
  stampHeart: { label: 'Heart', icon: Heart },
  stampQuestion: { label: 'Question', icon: CircleHelp },
  stampArrow: { label: 'Stamp arrow', icon: ArrowRight },
};
const shapes: AnnotationTool[] = [
  'line',
  'arrow',
  'doubleArrow',
  'rectangle',
  'ellipse',
  'diamond',
  'rectangleFilled',
  'ellipseFilled',
  'rectangleHighlight',
  'ellipseHighlight',
];
const stamps: AnnotationTool[] = [
  'stampCheck',
  'stampX',
  'stampStar',
  'stampHeart',
  'stampQuestion',
  'stampArrow',
];
const attention: AnnotationTool[] = ['spotlight', 'pointerArrow', 'vanishingPen'];
const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-sm p-0 text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none aria-pressed:bg-primary/10 aria-pressed:text-primary';
const menuToolButton = `${iconButton} min-h-11 w-full flex-col gap-1 px-2 py-2`;

function ToolButton({
  tool,
  active,
  disabled,
  choose,
  compact = false,
}: {
  tool: AnnotationTool;
  active: boolean;
  disabled: boolean;
  choose: () => void;
  compact?: boolean;
}) {
  const item = tools[tool];
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={compact ? iconButton : menuToolButton}
      aria-label={item.label}
      aria-pressed={active}
      disabled={disabled}
      title={`${item.label}${'shortcut' in item && item.shortcut ? ` (${item.shortcut})` : ''}`}
      onClick={choose}
    >
      <Icon
        aria-hidden="true"
        size={16}
        strokeWidth={2}
        fill={'filled' in item ? 'currentColor' : 'none'}
        className={'highlight' in item ? 'rounded bg-current/20' : undefined}
      />
      <span className={compact ? 'sr-only' : 'text-[10px] leading-tight'}>
        {item.label}
      </span>
    </button>
  );
}
function ToolMenu({
  label,
  icon,
  open,
  toggle,
  side,
  children,
  active = false,
  surface,
  inset,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  toggle: () => void;
  side: 'top' | 'bottom';
  children: ReactNode;
  active?: boolean;
  surface: HTMLDivElement | null;
  inset: number;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    content.current?.focus();
    return () => opener?.focus();
  }, [open]);
  return (
    <div>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-pressed={active}
        className={iconButton}
        onClick={toggle}
        title={label}
      >
        <span className="flex shrink-0 items-center gap-1">
          {icon}
          <ChevronDown aria-hidden="true" size={10} />
        </span>
        <span className="sr-only">{label}</span>
      </button>
      {open &&
        surface &&
        createPortal(
          <div
            ref={content}
            role="group"
            tabIndex={-1}
            data-annotation-panel
            aria-label={label}
            className="pointer-events-auto absolute left-2 z-40 w-64 max-w-[calc(100%-16px)] overflow-y-auto rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-sm"
            style={{
              [side === 'top' ? 'bottom' : 'top']: inset,
              maxHeight: `calc(100% - ${inset + 8}px)`,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold">{label}</p>
              <button
                type="button"
                aria-label={`Close ${label}`}
                className={iconButton}
                onClick={toggle}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {children}
          </div>,
          surface,
        )}
    </div>
  );
}
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
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [inset, setInset] = useState(8);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!surface || !toolbarRef.current) return;
    const measure = () =>
      setInset(surface.clientHeight > 360 ? toolbarRef.current!.offsetHeight + 16 : 8);
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    observer.observe(toolbarRef.current);
    measure();
    return () => observer.disconnect();
  }, [surface]);
  const side = dock === 'bottom' ? 'top' : 'bottom';
  const button =
    'min-h-11 rounded-lg px-3 text-xs text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';
  const close = () => {
    setExpanded(false);
    setPanel(null);
    setTool('cursor');
    launcherRef.current?.focus();
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        !toolbarRef.current?.contains(target) &&
        !target.closest?.('[data-annotation-panel]')
      )
        setPanel(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [surface]);
  const choose = (next: AnnotationTool) => {
    setTool(next);
    setPanel(null);
  };
  const menuProps = (label: string) =>
    ({
      label,
      open: panel === label,
      toggle: () => setPanel(panel === label ? null : label),
      side,
      surface,
      inset,
    }) as const;
  const grid = (items: AnnotationTool[]) => (
    <div className="grid grid-cols-3 gap-1">
      {items.map((item) => (
        <ToolButton
          key={item}
          tool={item}
          active={tool === item}
          disabled={!canDraw}
          choose={() => choose(item)}
        />
      ))}
    </div>
  );
  return (
    <div
      ref={setSurface}
      className="pointer-events-none absolute inset-0 z-30"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          if (panel) setPanel(null);
          else close();
        }
      }}
    >
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Screen annotations"
        aria-orientation="horizontal"
        className={`pointer-events-auto absolute z-30 flex w-fit max-w-[calc(100%-16px)] flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 text-foreground shadow-sm ${dock === 'top' ? 'left-2 top-2' : dock === 'bottom' ? 'bottom-2 left-2' : dock === 'left' ? 'left-2 top-2' : dock === 'right' ? 'right-2 top-2' : ''}`}
        style={dock === 'floating' ? { left: position.x, top: position.y } : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            if (panel) {
              setPanel(null);
            } else close();
          }
        }}
      >
        <button
          ref={launcherRef}
          type="button"
          aria-label={expanded ? 'Close annotation toolbar' : 'Open annotation toolbar'}
          aria-expanded={expanded}
          title={expanded ? 'Close annotations' : 'Annotate screen'}
          className={iconButton}
          onClick={() => {
            if (expanded) close();
            else {
              setExpanded(true);
              if (canDraw) setTool('pen');
            }
          }}
        >
          {expanded ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <Pencil size={16} aria-hidden="true" />
          )}
          <span className="sr-only">{expanded ? 'Close annotations' : 'Annotate'}</span>
        </button>
        {expanded && (
          <>
            <button
              type="button"
              className={`${iconButton} touch-none`}
              aria-label="Drag annotation toolbar"
              onPointerDown={(event) => {
                const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
                const parent = (
                  toolbarRef.current!.offsetParent as HTMLElement
                ).getBoundingClientRect();
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
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <div
              role="group"
              aria-label="Drawing tools"
              className="flex shrink-0 items-center gap-1"
            >
              {(
                [
                  'cursor',
                  'select',
                  'pen',
                  'highlighter',
                  'text',
                  'eraser',
                ] as AnnotationTool[]
              ).map((item) => (
                <ToolButton
                  key={item}
                  compact
                  tool={item}
                  active={tool === item}
                  disabled={!canDraw && item !== 'cursor'}
                  choose={() => choose(item)}
                />
              ))}
            </div>
            <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
            <div
              role="group"
              aria-label="More drawing tools"
              className="flex shrink-0 items-center gap-1"
            >
              <ToolMenu
                {...menuProps('Shapes')}
                icon={<Square size={16} aria-hidden="true" />}
                active={shapes.includes(tool)}
              >
                {grid(shapes)}
              </ToolMenu>
              <ToolMenu
                {...menuProps('Stamps')}
                icon={<Stamp size={16} aria-hidden="true" />}
                active={stamps.includes(tool)}
              >
                {grid(stamps)}
              </ToolMenu>
              <ToolMenu
                {...menuProps('Attention')}
                icon={<LocateFixed size={16} aria-hidden="true" />}
                active={attention.includes(tool)}
              >
                {grid(attention)}
                <p className="mt-2 text-xs text-muted-foreground">
                  Temporary marks to guide your class.
                </p>
              </ToolMenu>
            </div>
            <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
            <div
              role="group"
              aria-label="Annotation history"
              className="flex shrink-0 items-center gap-1"
            >
              <button
                type="button"
                aria-label="Undo"
                title="Undo (⌘/Ctrl+Z)"
                className={iconButton}
                disabled={!canDraw || !undoCount}
                onClick={undo}
              >
                <Undo2 size={16} aria-hidden="true" />
                <span className="sr-only">Undo</span>
              </button>
              <button
                type="button"
                aria-label="Redo"
                title="Redo (⌘/Ctrl+Shift+Z)"
                className={iconButton}
                disabled={!canDraw || !redoCount}
                onClick={redo}
              >
                <Redo2 size={16} aria-hidden="true" />
                <span className="sr-only">Redo</span>
              </button>
            </div>
            <ToolMenu
              {...menuProps('Format')}
              icon={
                <span className="relative">
                  <Palette size={16} aria-hidden="true" />
                  <span
                    className="absolute -bottom-1 -right-1 size-2.5 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: color }}
                  />
                </span>
              }
            >
              <div className="grid gap-2">
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
                <button
                  type="button"
                  className={button}
                  disabled={!canDraw}
                  onClick={onFormat}
                >
                  Apply to selected
                </button>
              </div>
            </ToolMenu>
            <ToolMenu
              {...menuProps('More')}
              icon={<Ellipsis size={16} aria-hidden="true" />}
            >
              <div className="grid gap-1">
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
                    <button
                      type="button"
                      className={button}
                      onClick={() => clear('students')}
                    >
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
                  <Copy size={16} className="mr-2 inline" aria-hidden="true" />
                  Duplicate selected
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={!canDraw}
                  onClick={onDelete}
                >
                  <Trash2 size={16} className="mr-2 inline" aria-hidden="true" />
                  Delete selected
                </button>
                <button type="button" className={button} onClick={onSave}>
                  <Download size={16} className="mr-2 inline" aria-hidden="true" />
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
            </ToolMenu>
          </>
        )}
      </div>
    </div>
  );
}
