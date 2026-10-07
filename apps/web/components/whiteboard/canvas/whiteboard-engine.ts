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
