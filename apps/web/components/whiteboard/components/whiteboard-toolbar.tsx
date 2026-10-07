'use client';
import { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
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
  StickyNote,
  Stamp,
  ScanLine,
  LassoSelect,
  SlidersHorizontal,
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
import {
  defaultWhiteboardStyle,
  type WhiteboardStyle,
  type WhiteboardEngine,
  type WhiteboardTool,
} from '../canvas/whiteboard-engine';
import { Popover, PopoverTrigger, PopoverContent } from '@iconicedu/ui-web/ui/popover';
import { CompactToolOptions } from './compact-tool-options';
export const whiteboardTools = [
  { tool: 'selection', label: 'Select', icon: MousePointer2, shortcut: 'V' },
  { tool: 'freedraw', label: 'Pen', icon: Pencil, shortcut: 'P' },
  { tool: 'text', label: 'Text', icon: Type, shortcut: 'T' },
  { tool: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { tool: 'eraser', label: 'Eraser', icon: Eraser },
  { tool: 'hand', label: 'Pan', icon: Hand, shortcut: 'H' },
  { tool: 'line', label: 'Line', icon: Minus },
  { tool: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'ellipse', label: 'Ellipse', icon: Circle },
  { tool: 'diamond', label: 'Diamond', icon: Diamond },
  { tool: 'frame', label: 'Frame', icon: Frame },
] as const;
const actionClass =
  'size-8 shrink-0 rounded-lg text-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary';
export function WhiteboardToolbar({
  engine,
  style = defaultWhiteboardStyle,
  editable,
  tool,
  onTool,
  onClear,
  canClear = editable,
  onLibrary,
  libraryOpen,
}: {
  engine: WhiteboardEngine | null;
  style?: WhiteboardStyle;
  editable: boolean;
  tool: WhiteboardTool;
  onTool: (tool: WhiteboardTool) => void;
  onClear: () => void;
  canClear?: boolean;
  onLibrary?: () => void;
  libraryOpen?: boolean;
}) {
  const [options, setOptions] = useState<string | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  useEffect(() => {
    setOptions(null);
  }, [tool]);
  useEffect(() => {
    setColors((previous) =>
      previous[tool] === style.strokeColor
        ? previous
        : { ...previous, [tool]: style.strokeColor },
    );
  }, [tool, style.strokeColor]);
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
      aria-label="Whiteboard tools"
      data-testid="whiteboard-toolbar"
      className="flex min-w-0 flex-wrap items-center gap-0.5"
    >
      <div role="group" aria-label="Drawing tools" className="flex items-center gap-0.5">
        {whiteboardTools
          .slice(0, 6)
          .filter((item) => item.tool !== 'highlighter')
          .map(({ tool: next, label, icon: Icon, ...rest }) => {
            const styled = ['freedraw', 'text', 'eraser'].includes(next);
            const color =
              tool === next || (next === 'freedraw' && tool === 'highlighter')
                ? style.strokeColor
                : (colors[next] ?? defaultWhiteboardStyle.strokeColor);
            const button = (
              <IconActionButton
                label={label}
                tooltip={`${label}${'shortcut' in rest ? ` (${rest.shortcut})` : ''}${styled ? ' · click again for options' : ''}`}
                variant="ghost"
                aria-pressed={
                  tool === next ||
                  (next === 'freedraw' && tool === 'highlighter') ||
                  (next === 'eraser' && tool === 'pixel-eraser')
                }
                disabled={!engine || (!editable && next !== 'hand')}
                className={`${actionClass} relative`}
                onClick={() => {
                  if (
                    tool !== next &&
                    !(next === 'freedraw' && tool === 'highlighter') &&
                    !(next === 'eraser' && tool === 'pixel-eraser')
                  )
                    choose(next);
                }}
              >
                {next === 'freedraw' && tool === 'highlighter' ? (
                  <Highlighter className="size-4" aria-hidden="true" />
                ) : (
                  <Icon className="size-4" aria-hidden="true" />
                )}
                {['freedraw', 'text'].includes(next) && (
                  <span
                    aria-label={`${label} color ${color}`}
                    className="absolute bottom-1 right-1 size-1.5 rounded-full ring-1 ring-card"
                    style={{ backgroundColor: color }}
                  />
                )}
              </IconActionButton>
            );
            if (!styled) return <span key={next}>{button}</span>;
            const active =
              tool === next ||
              (next === 'freedraw' && tool === 'highlighter') ||
              (next === 'eraser' && tool === 'pixel-eraser');
            return (
              <Popover
                key={next}
                open={options === next}
                onOpenChange={(open) => setOptions(open && active ? next : null)}
              >
                <PopoverTrigger asChild>{button}</PopoverTrigger>
                <PopoverContent
                  container={portal}
                  align="start"
                  className="w-60 gap-2 rounded-xl border border-border/60 p-3 shadow-md"
                  aria-label={`${label} options`}
                >
                  <CompactToolOptions
                    engine={engine}
                    tool={tool}
                    style={style}
                    onTool={choose}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
      </div>
      <DropdownMenu {...menuProps('shapes')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Shapes"
            aria-pressed={Boolean(activeShape)}
            title={activeShape ? `Shapes · ${activeShape.label}` : 'Shapes'}
            className={`${actionClass} relative`}
          >
            <ShapeIcon className="size-4" aria-hidden="true" />
            <span
              aria-label={`Shape color ${activeShape ? style.strokeColor : (colors.rectangle ?? defaultWhiteboardStyle.strokeColor)}`}
              className="absolute bottom-1 right-1 size-1.5 rounded-full ring-1 ring-card"
              style={{
                backgroundColor: activeShape
                  ? style.strokeColor
                  : (colors.rectangle ?? defaultWhiteboardStyle.strokeColor),
              }}
            />
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
      <Popover
        open={options === 'style'}
        onOpenChange={(open) => setOptions(open ? 'style' : null)}
      >
        <PopoverTrigger asChild>
          <IconActionButton
            label="Tool options"
            tooltip="Style and selected object options"
            className={actionClass}
            variant="ghost"
            disabled={!engine || !editable || tool === 'hand' || tool === 'laser'}
          >
            <SlidersHorizontal className="size-4" />
          </IconActionButton>
        </PopoverTrigger>
        <PopoverContent
          container={portal}
          align="start"
          className="w-60 gap-2 rounded-xl border border-border/60 p-3 shadow-md"
          aria-label="Tool options"
        >
          <CompactToolOptions
            engine={engine}
            tool={
              tool === 'selection' && style.selectedType === 'text'
                ? 'text'
                : tool === 'selection' &&
                    ['line', 'arrow'].includes(style.selectedType ?? '')
                  ? 'arrow'
                  : tool
            }
            style={style}
            onTool={choose}
          />
        </PopoverContent>
      </Popover>
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
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-border/60" />
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
          <DropdownMenuLabel>Meeting tools</DropdownMenuLabel>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => {
              engine?.insertNote();
              onTool('selection');
            }}
          >
            <StickyNote />
            Sticky note
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => {
              engine?.insertStamp('✓');
              onTool('selection');
            }}
          >
            <Stamp />
            Check mark stamp
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => {
              engine?.insertStamp('★');
              onTool('selection');
            }}
          >
            <Stamp />
            Star stamp
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => {
              engine?.insertStamp('?');
              onTool('selection');
            }}
          >
            <Stamp />
            Question stamp
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => choose('lasso')}
          >
            <LassoSelect />
            Lasso select
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => choose('pixel-eraser')}
          >
            <Eraser />
            Pixel eraser (pen strokes)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={!editable || !engine}
            onSelect={() => choose('laser')}
          >
            <ScanLine />
            Laser pointer (local)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
