'use client';

import { AnnotationToolType } from '@zoom/videosdk';
import {
  ArrowUpRight,
  Eraser,
  Highlighter,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { ANNOTATION_COLORS } from './zoom-video-session.constants';
import { annotationColorToHex } from './zoom-video-session.utils';
import { IconToolbarButton } from './zoom-meeting-controls';

const TOOLS = [
  { tool: AnnotationToolType.Pen, icon: Pencil, label: 'Pen' },
  { tool: AnnotationToolType.Highlighter, icon: Highlighter, label: 'Highlighter' },
  { tool: AnnotationToolType.Arrow, icon: ArrowUpRight, label: 'Arrow' },
  { tool: AnnotationToolType.Eraser, icon: Eraser, label: 'Eraser' },
] as const;

// Keep annotation controls one natural control-height above the meeting dock.
// This mirrors Zoom's shared-screen layout and also clears mobile safe areas.
const ANNOTATION_DOCK_BOTTOM = 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4.75rem)';

export function ZoomAnnotationControls({
  available,
  isAnnotating,
  selectedTool,
  onStart,
  onSelectTool,
  onSelectColor,
  onUndo,
  onRedo,
  onClear,
  onClose,
}: {
  available: boolean;
  isAnnotating: boolean;
  selectedTool: AnnotationToolType;
  onStart: (tool?: AnnotationToolType) => void;
  onSelectTool: (tool: AnnotationToolType) => void;
  onSelectColor: (color: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (!available) return null;

  if (!isAnnotating) {
    return (
      <div
        className="group absolute left-4 z-30 flex w-fit sm:left-6"
        style={{ bottom: ANNOTATION_DOCK_BOTTOM }}
      >
        <div className="invisible absolute bottom-full left-0 mb-2 flex items-center gap-1 rounded-2xl border border-border bg-popover/95 p-1.5 opacity-0 shadow-lg backdrop-blur-sm transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          {TOOLS.map(({ tool, icon: Icon, label }) => (
            <IconToolbarButton key={label} label={label} onClick={() => onStart(tool)}>
              <Icon className="size-4" />
            </IconToolbarButton>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="shadow-lg backdrop-blur-sm"
              aria-label="Annotate shared screen"
              onClick={() => onStart()}
            >
              <Pencil className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Annotate shared screen</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className="absolute left-3 z-30 flex w-fit max-w-[calc(100%-1.5rem)] flex-nowrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-popover/95 p-2 shadow-lg backdrop-blur-sm sm:left-6 sm:max-w-[calc(100%-3rem)]"
      style={{ bottom: ANNOTATION_DOCK_BOTTOM }}
      role="toolbar"
      aria-label="Annotation tools"
    >
      {TOOLS.map(({ tool, icon: Icon, label }) => (
        <IconToolbarButton
          key={label}
          label={label}
          active={selectedTool === tool}
          onClick={() => onSelectTool(tool)}
        >
          <Icon className="size-4" />
        </IconToolbarButton>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {ANNOTATION_COLORS.map((color) => (
        <button
          key={color.label}
          type="button"
          title={color.label}
          aria-label={`${color.label} annotation color`}
          onClick={() => onSelectColor(color.value)}
          className="size-5 shrink-0 cursor-pointer rounded-full ring-1 ring-border"
          style={{ backgroundColor: annotationColorToHex(color.value) }}
        />
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <IconToolbarButton label="Undo" onClick={onUndo}>
        <Undo2 className="size-4" />
      </IconToolbarButton>
      <IconToolbarButton label="Redo" onClick={onRedo}>
        <Redo2 className="size-4" />
      </IconToolbarButton>
      <IconToolbarButton label="Clear my annotations" onClick={onClear}>
        <Trash2 className="size-4" />
      </IconToolbarButton>
      <IconToolbarButton label="Close annotation" onClick={onClose}>
        <X className="size-4" />
      </IconToolbarButton>
    </div>
  );
}
