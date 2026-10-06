'use client';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
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
} from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import type { WhiteboardEngine, WhiteboardTool } from '../canvas/whiteboard-engine';
export const whiteboardTools = [
  { tool: 'selection', label: 'Select', icon: MousePointer2 },
  { tool: 'freedraw', label: 'Pen', icon: Pencil },
  { tool: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { tool: 'eraser', label: 'Eraser', icon: Eraser },
  { tool: 'text', label: 'Text', icon: Type },
  { tool: 'line', label: 'Line', icon: Minus },
  { tool: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'ellipse', label: 'Ellipse', icon: Circle },
] as const;
export function WhiteboardToolbar({
  engine,
  editable,
  tool,
  onTool,
  onClear,
  canClear = editable,
}: {
  engine: WhiteboardEngine | null;
  editable: boolean;
  tool: WhiteboardTool;
  onTool: (tool: WhiteboardTool) => void;
  onClear: () => void;
  canClear?: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Whiteboard tools"
      data-testid="whiteboard-toolbar"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card p-2"
    >
      {whiteboardTools.map(({ tool: next, label, icon: Icon }) => (
        <IconActionButton
          key={next}
          label={label}
          variant={tool === next ? 'default' : 'ghost'}
          aria-pressed={tool === next}
          disabled={!engine || !editable}
          className="h-11 w-11 shrink-0"
          onClick={() => {
            onTool(next);
            engine?.setTool(next);
          }}
        >
          <Icon className="h-5 w-5" />
        </IconActionButton>
      ))}
      <span className="mx-1 h-6 border-r border-border" />
      <IconActionButton
        variant="ghost"
        label="Undo"
        disabled={!editable || !engine}
        onClick={() => engine?.undo()}
        className="h-11 w-11 shrink-0"
      >
        <Undo2 className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Redo"
        disabled={!editable || !engine}
        onClick={() => engine?.redo()}
        className="h-11 w-11 shrink-0"
      >
        <Redo2 className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Zoom out"
        onClick={() => engine?.zoomBy(-0.1)}
        className="h-11 w-11 shrink-0"
      >
        <ZoomOut className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Zoom in"
        onClick={() => engine?.zoomBy(0.1)}
        className="h-11 w-11 shrink-0"
      >
        <ZoomIn className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Fit content"
        onClick={() => engine?.zoomToFit()}
        className="h-11 w-11 shrink-0"
      >
        <Scan className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Reset zoom to 100%"
        onClick={() => engine?.resetZoom()}
        className="h-11 w-11 shrink-0"
      >
        <RotateCcw className="h-5 w-5" />
      </IconActionButton>
      <IconActionButton
        variant="ghost"
        label="Clear page"
        disabled={!editable || !engine || !canClear}
        onClick={onClear}
        className="h-11 w-11 shrink-0"
      >
        <Trash2 className="h-5 w-5" />
      </IconActionButton>
    </div>
  );
}
