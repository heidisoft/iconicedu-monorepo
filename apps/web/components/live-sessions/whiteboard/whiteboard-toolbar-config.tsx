'use client';

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eraser,
  FileText,
  Hand,
  Highlighter,
  Image,
  Lock,
  Minus,
  MousePointer,
  MousePointer2,
  MoveRight,
  Pencil,
  Type,
  WandSparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

// ─── Option types ─────────────────────────────────────────────────────────────

export type ColorOption = { id: string; label: string; value: string };

export type StrokeWidthOption = { id: string; label: string; value: number };

export type StrokeStyleOption = {
  id: string;
  label: string;
  value: 'solid' | 'dashed' | 'dotted';
  icon: ReactNode;
};

export type FontSizeOption = { id: string; label: string; value: number };

export type FontFamilyOption = {
  id: string;
  label: string;
  /** 1 = Excalifont, 2 = Nunito, 3 = Cascadia */
  value: number;
  icon: ReactNode;
};

export type TextAlignOption = {
  id: string;
  label: string;
  value: 'left' | 'center' | 'right';
  icon: ReactNode;
};

export type ArrowheadOption = {
  id: string;
  label: string;
  value: 'none' | 'arrow' | 'triangle' | 'bar';
  icon: ReactNode;
};

export type ToolOptions = {
  colors?: ColorOption[];
  strokeWidths?: StrokeWidthOption[];
  strokeStyles?: StrokeStyleOption[];
  fontSizes?: FontSizeOption[];
  fontFamilies?: FontFamilyOption[];
  textAligns?: TextAlignOption[];
  arrowheads?: ArrowheadOption[];
};

// ─── Active option state ──────────────────────────────────────────────────────

export type ActiveToolOptions = {
  color?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  fontFamily?: number;
  textAlign?: 'left' | 'center' | 'right';
  endArrowhead?: 'none' | 'arrow' | 'triangle' | 'bar';
};

// ─── Tool / action types ──────────────────────────────────────────────────────

export type ExcalidrawTool =
  | { type: 'hand' }
  | { type: 'selection' }
  | { type: 'laser' }
  | { type: 'freedraw' }
  | { type: 'text' }
  | { type: 'arrow' }
  | { type: 'eraser' };

export type ToolbarAction = 'upload-pdf' | 'upload-image' | 'follow-me' | 'lock-student';

export type ToolbarItemConfig =
  | {
      kind: 'tool';
      id: string;
      label: string;
      icon: ReactNode;
      tool: ExcalidrawTool;
      applyStyle?: (api: ExcalidrawImperativeAPI, opts: ActiveToolOptions) => void;
      options?: ToolOptions;
    }
  | {
      kind: 'action';
      id: string;
      label: string;
      icon: ReactNode;
      action: ToolbarAction;
      isToggle?: boolean;
      defaultActive?: boolean;
    }
  | { kind: 'separator'; id: string };

// ─── Shared option presets ────────────────────────────────────────────────────

const DRAW_COLORS: ColorOption[] = [
  { id: 'black', label: 'Black', value: '#1e1e1e' },
  { id: 'blue', label: 'Blue', value: '#1971c2' },
  { id: 'red', label: 'Red', value: '#e03131' },
  { id: 'green', label: 'Green', value: '#2f9e44' },
  { id: 'orange', label: 'Orange', value: '#e67700' },
  { id: 'purple', label: 'Purple', value: '#7048e8' },
];

const DRAW_WIDTHS: StrokeWidthOption[] = [
  { id: 'thin', label: 'Thin', value: 1 },
  { id: 'medium', label: 'Medium', value: 2 },
  { id: 'thick', label: 'Thick', value: 4 },
];

const DRAW_STYLES: StrokeStyleOption[] = [
  {
    id: 'solid',
    label: 'Solid',
    value: 'solid',
    icon: (
      <svg width="28" height="8" viewBox="0 0 28 8">
        <line
          x1="2"
          y1="4"
          x2="26"
          y2="4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'dashed',
    label: 'Dashed',
    value: 'dashed',
    icon: (
      <svg width="28" height="8" viewBox="0 0 28 8">
        <line
          x1="2"
          y1="4"
          x2="26"
          y2="4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 3"
        />
      </svg>
    ),
  },
  {
    id: 'dotted',
    label: 'Dotted',
    value: 'dotted',
    icon: (
      <svg width="28" height="8" viewBox="0 0 28 8">
        <line
          x1="2"
          y1="4"
          x2="26"
          y2="4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 4"
        />
      </svg>
    ),
  },
];

const HIGHLIGHTER_WIDTHS: StrokeWidthOption[] = [
  { id: 'thin', label: 'Thin', value: 8 },
  { id: 'medium', label: 'Medium', value: 16 },
  { id: 'thick', label: 'Thick', value: 24 },
];

const HIGHLIGHTER_COLORS: ColorOption[] = [
  { id: 'yellow', label: 'Yellow', value: '#ffd43b' },
  { id: 'green', label: 'Green', value: '#69db7c' },
  { id: 'blue', label: 'Blue', value: '#74c0fc' },
  { id: 'pink', label: 'Pink', value: '#f783ac' },
  { id: 'orange', label: 'Orange', value: '#ffa94d' },
];

const TEXT_FONT_SIZES: FontSizeOption[] = [
  { id: 'sm', label: 'S', value: 16 },
  { id: 'md', label: 'M', value: 20 },
  { id: 'lg', label: 'L', value: 28 },
  { id: 'xl', label: 'XL', value: 36 },
];

const TEXT_FONT_FAMILIES: FontFamilyOption[] = [
  {
    id: 'sketch',
    label: 'Sketch',
    value: 1,
    icon: (
      <span className="font-bold italic" style={{ fontFamily: 'cursive', fontSize: 13 }}>
        A
      </span>
    ),
  },
  {
    id: 'sans',
    label: 'Sans',
    value: 2,
    icon: (
      <span className="font-semibold" style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
        A
      </span>
    ),
  },
  {
    id: 'mono',
    label: 'Mono',
    value: 3,
    icon: (
      <span className="font-semibold" style={{ fontFamily: 'monospace', fontSize: 12 }}>
        A
      </span>
    ),
  },
];

const TEXT_ALIGNS: TextAlignOption[] = [
  {
    id: 'left',
    label: 'Left',
    value: 'left',
    icon: <AlignLeft className="h-3.5 w-3.5" />,
  },
  {
    id: 'center',
    label: 'Center',
    value: 'center',
    icon: <AlignCenter className="h-3.5 w-3.5" />,
  },
  {
    id: 'right',
    label: 'Right',
    value: 'right',
    icon: <AlignRight className="h-3.5 w-3.5" />,
  },
];

const ARROW_HEADS: ArrowheadOption[] = [
  {
    id: 'none',
    label: 'None',
    value: 'none',
    icon: (
      <svg width="24" height="10" viewBox="0 0 24 10">
        <line
          x1="2"
          y1="5"
          x2="22"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    value: 'arrow',
    icon: (
      <svg width="24" height="10" viewBox="0 0 24 10">
        <line
          x1="2"
          y1="5"
          x2="18"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points="14,2 22,5 14,8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'triangle',
    label: 'Triangle',
    value: 'triangle',
    icon: (
      <svg width="24" height="10" viewBox="0 0 24 10">
        <line
          x1="2"
          y1="5"
          x2="16"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polygon points="16,2 22,5 16,8" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'bar',
    label: 'Bar',
    value: 'bar',
    icon: (
      <svg width="24" height="10" viewBox="0 0 24 10">
        <line
          x1="2"
          y1="5"
          x2="20"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="2"
          x2="20"
          y2="8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

// ─── Style appliers ───────────────────────────────────────────────────────────

type AppState = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['appState'];

function applyPenStyle(api: ExcalidrawImperativeAPI, opts: ActiveToolOptions) {
  api.updateScene({
    appState: {
      currentItemOpacity: 100,
      currentItemStrokeColor: opts.color ?? '#1e1e1e',
      currentItemStrokeWidth: opts.strokeWidth ?? 1,
      // freedraw ignores strokeStyle — kept for symmetry with arrow
    } as AppState,
  });
}

function applyHighlighterStyle(api: ExcalidrawImperativeAPI, opts: ActiveToolOptions) {
  api.updateScene({
    appState: {
      currentItemOpacity: 40,
      currentItemStrokeColor: opts.color ?? '#ffd43b',
      currentItemStrokeWidth: opts.strokeWidth ?? 8,
    } as AppState,
  });
}

function applyTextStyle(api: ExcalidrawImperativeAPI, opts: ActiveToolOptions) {
  api.updateScene({
    appState: {
      currentItemStrokeColor: opts.color ?? '#1e1e1e',
      currentItemFontSize: opts.fontSize ?? 20,
      currentItemFontFamily: opts.fontFamily ?? 1,
      currentItemTextAlign: opts.textAlign ?? 'left',
    } as AppState,
  });
}

function applyArrowStyle(api: ExcalidrawImperativeAPI, opts: ActiveToolOptions) {
  const arrowhead = opts.endArrowhead ?? 'arrow';
  api.updateScene({
    appState: {
      currentItemStrokeColor: opts.color ?? '#1e1e1e',
      currentItemStrokeWidth: opts.strokeWidth ?? 2,
      currentItemStrokeStyle: opts.strokeStyle ?? 'solid',
      currentItemStartArrowhead: null,
      currentItemEndArrowhead: arrowhead === 'none' ? null : arrowhead,
    } as AppState,
  });
}

// ─── Toolbar presets ──────────────────────────────────────────────────────────

const HAND_TOOL: ToolbarItemConfig = {
  kind: 'tool',
  id: 'hand',
  label: 'Hand',
  icon: <Hand className="h-4 w-4" />,
  tool: { type: 'hand' },
};

const SELECT_TOOL: ToolbarItemConfig = {
  kind: 'tool',
  id: 'select',
  label: 'Select',
  icon: <MousePointer className="h-4 w-4" />,
  tool: { type: 'selection' },
};

export const TEACHER_TOOLBAR: ToolbarItemConfig[] = [
  HAND_TOOL,
  SELECT_TOOL,
  { kind: 'separator', id: 'sep-0' },
  {
    kind: 'tool',
    id: 'laser',
    label: 'Laser',
    icon: <WandSparkles className="h-4 w-4" />,
    tool: { type: 'laser' },
  },
  {
    kind: 'tool',
    id: 'pen',
    label: 'Pen',
    icon: <Pencil className="h-4 w-4" />,
    tool: { type: 'freedraw' },
    applyStyle: applyPenStyle,
    options: { colors: DRAW_COLORS, strokeWidths: DRAW_WIDTHS },
  },
  {
    kind: 'tool',
    id: 'highlighter',
    label: 'Highlight',
    icon: <Highlighter className="h-4 w-4" />,
    tool: { type: 'freedraw' },
    applyStyle: applyHighlighterStyle,
    options: { colors: HIGHLIGHTER_COLORS, strokeWidths: HIGHLIGHTER_WIDTHS },
  },
  {
    kind: 'tool',
    id: 'text',
    label: 'Text',
    icon: <Type className="h-4 w-4" />,
    tool: { type: 'text' },
    applyStyle: applyTextStyle,
    options: {
      colors: DRAW_COLORS,
      fontSizes: TEXT_FONT_SIZES,
      fontFamilies: TEXT_FONT_FAMILIES,
      textAligns: TEXT_ALIGNS,
    },
  },
  {
    kind: 'tool',
    id: 'arrow',
    label: 'Arrow',
    icon: <MoveRight className="h-4 w-4" />,
    tool: { type: 'arrow' },
    applyStyle: applyArrowStyle,
    options: {
      colors: DRAW_COLORS,
      strokeWidths: DRAW_WIDTHS,
      strokeStyles: DRAW_STYLES,
      arrowheads: ARROW_HEADS,
    },
  },
  {
    kind: 'tool',
    id: 'eraser',
    label: 'Eraser',
    icon: <Eraser className="h-4 w-4" />,
    tool: { type: 'eraser' },
  },
  { kind: 'separator', id: 'sep-1' },
  {
    kind: 'action',
    id: 'upload-pdf',
    label: 'PDF',
    icon: <FileText className="h-4 w-4" />,
    action: 'upload-pdf',
  },
  {
    kind: 'action',
    id: 'upload-image',
    label: 'Image',
    icon: <Image className="h-4 w-4" />,
    action: 'upload-image',
  },
  { kind: 'separator', id: 'sep-2' },
  {
    kind: 'action',
    id: 'follow-me',
    label: 'Follow Me',
    icon: <MousePointer2 className="h-4 w-4" />,
    action: 'follow-me',
    isToggle: true,
    defaultActive: true,
  },
  {
    kind: 'action',
    id: 'lock-student',
    label: 'Lock',
    icon: <Lock className="h-4 w-4" />,
    action: 'lock-student',
    isToggle: true,
    defaultActive: false,
  },
];

export const STUDENT_TOOLBAR: ToolbarItemConfig[] = [
  HAND_TOOL,
  SELECT_TOOL,
  { kind: 'separator', id: 'sep-0' },
  {
    kind: 'tool',
    id: 'pen',
    label: 'Pen',
    icon: <Pencil className="h-4 w-4" />,
    tool: { type: 'freedraw' },
    applyStyle: applyPenStyle,
    options: { colors: DRAW_COLORS, strokeWidths: DRAW_WIDTHS },
  },
  {
    kind: 'tool',
    id: 'highlighter',
    label: 'Highlight',
    icon: <Highlighter className="h-4 w-4" />,
    tool: { type: 'freedraw' },
    applyStyle: applyHighlighterStyle,
    options: { colors: HIGHLIGHTER_COLORS, strokeWidths: HIGHLIGHTER_WIDTHS },
  },
  {
    kind: 'tool',
    id: 'text',
    label: 'Text',
    icon: <Type className="h-4 w-4" />,
    tool: { type: 'text' },
    applyStyle: applyTextStyle,
    options: {
      colors: DRAW_COLORS,
      fontSizes: TEXT_FONT_SIZES,
      fontFamilies: TEXT_FONT_FAMILIES,
      textAligns: TEXT_ALIGNS,
    },
  },
  {
    kind: 'tool',
    id: 'eraser',
    label: 'Eraser',
    icon: <Eraser className="h-4 w-4" />,
    tool: { type: 'eraser' },
  },
];

// Re-export option presets so callers can build custom toolbars
export {
  DRAW_COLORS,
  DRAW_WIDTHS,
  DRAW_STYLES,
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_WIDTHS,
  TEXT_FONT_SIZES,
  TEXT_FONT_FAMILIES,
  TEXT_ALIGNS,
  ARROW_HEADS,
};
