import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import type { WhiteboardAsset } from '../assets/registry';
export type WhiteboardTool =
  | 'selection'
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
  exportSvg(): Promise<SVGSVGElement>;
}
