import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import type { WhiteboardAsset } from '../assets/registry';
export type WhiteboardTool =
  | 'lasso'
  | 'pixel-eraser'
  | 'diamond'
  | 'frame'
  | 'laser'
  | 'selection'
  | 'hand'
  | 'freedraw'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse';
export interface WhiteboardEngine {
  getStyle(): WhiteboardStyle;
  setStyle(style: Partial<WhiteboardStyle>): void;
  getElements(): WhiteboardElementVM[];
  importScene(elements: WhiteboardElementVM[]): void;
  exportScene(): string;
  setTool(tool: WhiteboardTool): void;
  insertAsset(asset: WhiteboardAsset): void;
  clear(): void;
  deleteSelection(): void;
  undo(): void;
  redo(): void;
  zoomBy(delta: number): void;
  resetZoom(): void;
  zoomToFit(): void;
  setEditable(editable: boolean): void;
  selectLasso(points: [number, number][]): void;
  erasePixels(point: [number, number], radius: number): void;
  setGrid(mode: 'none' | 'dots' | 'lines', snap: boolean): void;
  exportPng(): Promise<Blob>;
  insertNote(): void;
  insertStamp(text: string): void;
  exportSvg(): Promise<SVGSVGElement>;
}

export interface WhiteboardStyle {
  selectedType?: string;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  fillStyle: 'solid' | 'hachure' | 'cross-hatch' | 'zigzag';
  fontSize: number;
  fontFamily: number;
  startArrowhead: string | null;
  endArrowhead: string | null;
  textAlign: 'left' | 'center' | 'right';
}
export const defaultWhiteboardStyle: WhiteboardStyle = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  strokeWidth: 2,
  opacity: 100,
  fillStyle: 'solid',
  fontSize: 20,
  fontFamily: 2,
  startArrowhead: null,
  endArrowhead: 'arrow',
  textAlign: 'left',
};
