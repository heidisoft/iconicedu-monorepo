'use client';
import { useState, type ComponentProps } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Shapes,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  Scan,
  RotateCcw,
  Trash2,
  Ellipsis,
  ChevronDown,
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
function LaserPointerIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m4 17 9-9 3 3-9 9H4v-3Z" />
      <path d="m11 10 3 3M17 7l4-4M18 10h3M14 6V3" />
    </svg>
  );
}
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
const actionClass =
  'size-8 shrink-0 rounded-sm text-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary';
export function WhiteboardToolbar({
  engine,
  editable,
  tool,
  onTool,
  onClear,
  canClear = editable,
  onLibrary,
  libraryOpen,
}: {
  engine: WhiteboardEngine | null;
  editable: boolean;
  tool: WhiteboardTool;
  onTool: (tool: WhiteboardTool) => void;
  onClear: () => void;
  canClear?: boolean;
  onLibrary?: () => void;
  libraryOpen?: boolean;
}) {
  const [grid, setGrid] = useState<'none' | 'dots' | 'lines'>('dots');
  const [snap, setSnap] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const portal = typeof document === 'undefined' ? undefined : document.fullscreenElement;
  const shapeTools = whiteboardTools.slice(6);
  const activeShape = shapeTools.find((item) => item.tool === tool);
  const ShapeIcon = activeShape?.icon ?? Shapes;
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
            variant="ghost"
            aria-pressed={tool === next}
            disabled={!engine || (!editable && next !== 'hand')}
            className={actionClass}
            onClick={() => choose(next)}
          >
            <Icon className="size-4" aria-hidden="true" />
          </IconActionButton>
        ))}
      </div>
      <DropdownMenu {...menuProps('shapes')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Shapes"
            aria-pressed={Boolean(activeShape)}
            title={activeShape ? `Shapes · ${activeShape.label}` : 'Shapes'}
            className={actionClass}
          >
            <ShapeIcon className="size-4" aria-hidden="true" />
            <ChevronDown className="size-2.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={portal}
          className="w-56 border border-border/60 shadow-sm"
          align="start"
        >
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
        </DropdownMenuContent>
      </DropdownMenu>
      {onLibrary && (
        <IconActionButton
          label="Library"
          tooltip="Educational library"
          variant="ghost"
          aria-pressed={libraryOpen}
          className={actionClass}
          onClick={onLibrary}
        >
          <Library className="size-4" aria-hidden="true" />
        </IconActionButton>
      )}
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
      <IconActionButton
        label="Undo"
        tooltip="Undo (⌘/Ctrl+Z)"
        variant="ghost"
        disabled={!editable || !engine}
        className={actionClass}
        onClick={() => engine?.undo()}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconActionButton>
      <DropdownMenu {...menuProps('view')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="View controls"
            title="Zoom and fit"
            className={actionClass}
          >
            <Scan className="size-4" aria-hidden="true" />
            <ChevronDown className="size-2.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={portal}
          className="w-56 border border-border/60 shadow-sm"
          align="start"
        >
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
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu {...menuProps('more')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="More whiteboard actions"
            title="More actions"
            className={actionClass}
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={portal}
          className="w-56 border border-border/60 shadow-sm"
          align="end"
        >
          <DropdownMenuLabel>More actions</DropdownMenuLabel>
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
