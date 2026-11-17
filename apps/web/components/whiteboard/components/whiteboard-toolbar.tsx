'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { LaserPointerIcon } from '@iconicedu/ui-web/ui/laser-pointer-icon';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  Scan,
  RotateCcw,
  Trash2,
  Ellipsis,
  Library,
  Diamond,
  Frame,
} from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import type { WhiteboardEngine, WhiteboardTool } from '../canvas/whiteboard-engine';
export const whiteboardTools = [
  { tool: 'hand', label: 'Pan', icon: Hand, shortcut: 'H' },
  { tool: 'laser', label: 'Laser pointer', icon: LaserPointerIcon, shortcut: 'K' },
  { tool: 'selection', label: 'Select', icon: MousePointer2, shortcut: 'V' },
  { tool: 'freedraw', label: 'Pen', icon: Pencil, shortcut: 'P' },
  { tool: 'text', label: 'Text', icon: Type, shortcut: 'T' },
  { tool: 'eraser', label: 'Eraser', icon: Eraser },
  { tool: 'line', label: 'Line', icon: Minus },
  { tool: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'ellipse', label: 'Ellipse', icon: Circle },
  { tool: 'diamond', label: 'Diamond', icon: Diamond },
  { tool: 'frame', label: 'Frame', icon: Frame },
] as const;
const actionClass = 'size-8 shrink-0 rounded-full';
export function WhiteboardToolbar({
  engine,
  editable,
  tool,
  onTool,
  onClear,
  canClear = editable,
  onLibrary,
  followControl,
  moreContent,
}: {
  engine: WhiteboardEngine | null;
  editable: boolean;
  tool: WhiteboardTool;
  onTool: (tool: WhiteboardTool) => void;
  onClear: () => void;
  canClear?: boolean;
  onLibrary?: () => void;
  libraryOpen?: boolean;
  followControl?: ReactNode;
  moreContent?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [spacious, setSpacious] = useState(false);
  useEffect(() => {
    const surface = root.current?.closest('section');
    if (!surface || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setSpacious(surface.clientWidth >= 760 && surface.clientHeight >= 600);
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    measure();
    return () => observer.disconnect();
  }, []);
  const [grid, setGrid] = useState<'none' | 'dots' | 'lines'>('dots');
  const [snap, setSnap] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const portal = typeof document === 'undefined' ? undefined : document.fullscreenElement;
  const shapeTools = whiteboardTools.slice(6);
  const choose = (next: WhiteboardTool) => {
    onTool(next);
    engine?.setTool(next);
  };
  const menuProps = (name: string) => ({
    open: menu === name,
    onOpenChange: (open: boolean) => setMenu(open ? name : null),
  });
  return (
    <div
      ref={root}
      role="toolbar"
      aria-orientation="horizontal"
      aria-label="Whiteboard tools"
      data-testid="whiteboard-toolbar"
      className="flex min-w-max items-center gap-1"
    >
      <div role="group" aria-label="Drawing tools" className="flex items-center gap-1">
        {whiteboardTools.slice(0, 6).map(({ tool: next, label, icon: Icon, ...rest }) => (
          <IconActionButton
            key={next}
            label={label}
            tooltip={`${label}${'shortcut' in rest ? ` (${rest.shortcut})` : ''}`}
            variant="toolbar"
            aria-pressed={tool === next}
            disabled={!engine || (!editable && next !== 'hand')}
            className={actionClass}
            onClick={() => choose(next)}
          >
            <Icon className="size-4" aria-hidden="true" />
          </IconActionButton>
        ))}
      </div>

      <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
      <IconActionButton
        label="Undo"
        tooltip="Undo (⌘/Ctrl+Z)"
        variant="toolbar"
        disabled={!editable || !engine}
        className={actionClass}
        onClick={() => engine?.undo()}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconActionButton>

      {spacious && (
        <div className="flex">
          <IconActionButton
            label="Redo"
            tooltip="Redo"
            variant="toolbar"
            className={actionClass}
            disabled={!editable || !engine}
            onClick={() => engine?.redo()}
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </IconActionButton>
          {onLibrary && (
            <IconActionButton
              label="Library"
              tooltip="Educational library"
              variant="toolbar"
              className={actionClass}
              disabled={!editable || !engine}
              onClick={onLibrary}
            >
              <Library className="size-4" aria-hidden="true" />
            </IconActionButton>
          )}
        </div>
      )}
      <DropdownMenu {...menuProps('more')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="toolbar"
            aria-label="More whiteboard actions"
            aria-pressed={shapeTools.some((item) => item.tool === tool)}
            title="More actions"
            className={actionClass}
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={portal}
          className="w-56 rounded-xl border border-border/60 shadow-sm"
          align="end"
        >
          <DropdownMenuLabel>More actions</DropdownMenuLabel>
          {onLibrary && (
            <DropdownMenuItem onSelect={onLibrary}>
              <Library />
              Library
            </DropdownMenuItem>
          )}
          {followControl && <DropdownMenuItem asChild>{followControl}</DropdownMenuItem>}
          <DropdownMenuLabel>Shapes</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={tool}
            onValueChange={(value) => choose(value as WhiteboardTool)}
          >
            {shapeTools.map(({ tool: next, label, icon: Icon }) => (
              <DropdownMenuRadioItem
                key={next}
                value={next}
                disabled={!engine || !editable}
                className="min-h-11"
              >
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={grid}
            onValueChange={(value) => {
              const next = value as 'none' | 'dots' | 'lines';
              setGrid(next);
              engine?.setGrid(next, snap);
            }}
          >
            <DropdownMenuRadioItem value="none">No grid</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dots">Dot grid</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="lines">Line grid</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuCheckboxItem
            checked={snap}
            disabled={!engine}
            onCheckedChange={(enabled) => {
              setSnap(enabled);
              engine?.setGrid(grid, enabled);
            }}
          >
            Snap to grid
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11"
            disabled={!engine}
            onSelect={() => engine?.zoomToFit()}
          >
            <Scan />
            Fit content
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11"
            disabled={!engine}
            onSelect={() => engine?.zoomBy(0.1)}
          >
            <ZoomIn />
            Zoom in
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!engine}
            onSelect={() => engine?.zoomBy(-0.1)}
          >
            <ZoomOut />
            Zoom out
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!engine}
            onSelect={() => engine?.resetZoom()}
          >
            <RotateCcw />
            Reset zoom to 100%
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {moreContent}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11"
            disabled={!engine || !editable}
            onSelect={() => engine?.redo()}
          >
            <Redo2 />
            Redo<span className="ml-auto text-xs text-muted-foreground">⇧⌘Z</span>
          </DropdownMenuItem>
          {canClear && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="min-h-11"
                disabled={!engine || !editable}
                onSelect={onClear}
              >
                <Trash2 />
                Clear board
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
