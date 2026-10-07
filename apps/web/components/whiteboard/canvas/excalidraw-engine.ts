import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  exportToSvg,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import type { WhiteboardAsset } from '../assets/registry';
import type { WhiteboardEngine, WhiteboardTool } from './whiteboard-engine';
import { SceneHistory, changedElements } from './scene-history';

export function wrapCanvasElements(
  elements: readonly ExcalidrawElement[],
): WhiteboardElementVM[] {
  return elements.map((e) => ({
    id: e.id,
    version: e.version,
    nonce: e.versionNonce,
    deleted: e.isDeleted,
    data: JSON.parse(JSON.stringify({ ...e, link: null })) as Record<string, unknown>,
  }));
}
/** The only module translating application assets and scenes into Excalidraw APIs. */
export class ExcalidrawWhiteboardEngine implements WhiteboardEngine {
  private history = new SceneHistory();
  private before: WhiteboardElementVM[] | null = null;
  private observed: WhiteboardElementVM[] = [];
  private localIds = new Set<string>();
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly api: ExcalidrawImperativeAPI,
    private readonly changed: (elements: WhiteboardElementVM[]) => void,
  ) {}
  getElements() {
    return wrapCanvasElements(this.api.getSceneElementsIncludingDeleted());
  }
  importScene(elements: WhiteboardElementVM[]) {
    this.api.updateScene({
      elements: restoreElements(
        elements.map((e) => e.data) as unknown as ExcalidrawElement[],
        null,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    this.observed = this.getElements();
  }
  exportScene() {
    return JSON.stringify({ schemaVersion: 1, elements: this.getElements() });
  }
  begin() {
    this.commit();
    this.before = this.getElements();
    this.observed = this.before;
  }
  observe(elements: WhiteboardElementVM[]) {
    if (!this.before) this.before = this.observed;
    for (const e of changedElements(this.observed, elements)) this.localIds.add(e.id);
    this.observed = elements;
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => this.commit(), 450);
  }
  commit() {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    if (this.before) {
      this.history.record(
        this.before,
        this.getElements().filter((e) => this.localIds.has(e.id)),
      );
      this.before = null;
      this.localIds.clear();
    }
  }
  dispose() {
    if (this.commitTimer) clearTimeout(this.commitTimer);
  }
  private transact(action: () => void) {
    const before = this.getElements();
    action();
    this.history.record(before, this.getElements());
    this.changed(this.getElements());
  }
  private lastTool: WhiteboardTool = 'selection';
  setTool(tool: WhiteboardTool) {
    this.api.setActiveTool({ type: tool === 'highlighter' ? 'freedraw' : tool });
    this.api.updateScene({
      appState: { openMenu: tool === 'hand' || tool === 'eraser' ? null : 'shape' },
    });
    if (tool === 'highlighter' || this.lastTool === 'highlighter')
      this.api.updateScene({
        appState: {
          currentItemOpacity: tool === 'highlighter' ? 35 : 100,
          currentItemStrokeWidth: tool === 'highlighter' ? 8 : 2,
        },
      });
    this.lastTool = tool;
  }
  insertAsset(asset: WhiteboardAsset) {
    const state = this.api.getAppState();
    const x = state.width / 2 / state.zoom.value - state.scrollX - asset.width / 2;
    const y = state.height / 2 / state.zoom.value - state.scrollY - asset.height / 2;
    const groupId = crypto.randomUUID();
    const elements = convertToExcalidrawElements(
      asset.primitives.map((p) => {
        const common = {
          x: x + p.x,
          y: y + p.y,
          strokeColor: ('color' in p && p.color) || '#1e293b',
          roughness: 0,
          fillStyle: 'solid' as const,
          fontFamily: 2 as const,
          groupIds: [groupId],
        };
        if (p.type === 'line') {
          const minX = Math.min(...p.points.map((point) => point[0])),
            minY = Math.min(...p.points.map((point) => point[1]));
          return {
            ...common,
            type: 'line' as const,
            x: common.x + minX,
            y: common.y + minY,
            width: Math.max(...p.points.map((point) => point[0])) - minX,
            height: Math.max(...p.points.map((point) => point[1])) - minY,
            points: p.points.map(
              (point) => [point[0] - minX, point[1] - minY] as [number, number],
            ),
            strokeWidth: p.width ?? 1,
          };
        }
        if (p.type === 'text')
          return {
            ...common,
            type: 'text' as const,
            text: p.text,
            fontSize: p.size ?? 18,
          };
        return {
          ...common,
          type: 'rectangle' as const,
          width: p.width,
          height: p.height,
          backgroundColor: p.color ?? 'transparent',
        };
      }),
    );
    this.transact(() =>
      this.api.updateScene({
        elements: [...this.api.getSceneElementsIncludingDeleted(), ...elements],
        appState: {
          selectedElementIds: Object.fromEntries(elements.map((e) => [e.id, true])),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      }),
    );
    this.api.setActiveTool({ type: 'selection' });
  }
  private deleteIds(ids: Set<string>) {
    const elements = this.getElements().map((e) =>
      ids.has(e.id)
        ? {
            ...e,
            deleted: true,
            version: e.version + 1,
            data: { ...e.data, isDeleted: true, version: e.version + 1 },
          }
        : e,
    );
    this.transact(() => this.importScene(elements));
  }
  clear() {
    this.deleteIds(new Set(this.getElements().map((e) => e.id)));
  }
  deleteSelection() {
    this.deleteIds(new Set(Object.keys(this.api.getAppState().selectedElementIds)));
  }
  undo() {
    this.commit();
    this.importScene(this.history.undo(this.getElements()));
    this.changed(this.getElements());
  }
  redo() {
    this.importScene(this.history.redo(this.getElements()));
    this.changed(this.getElements());
  }
  zoomBy(delta: number) {
    const value = Math.max(0.1, Math.min(4, this.api.getAppState().zoom.value + delta));
    this.api.updateScene({
      appState: {
        zoom: {
          value: value as ReturnType<
            ExcalidrawImperativeAPI['getAppState']
          >['zoom']['value'],
        },
      },
    });
  }
  zoomToFit() {
    this.api.scrollToContent(undefined, { fitToContent: true });
  }
  resetZoom() {
    this.zoomBy(1 - this.api.getAppState().zoom.value);
  }
  setEditable(editable: boolean) {
    this.api.updateScene({ appState: { viewModeEnabled: !editable } });
  }
  exportSvg() {
    return exportToSvg({
      elements: this.api.getSceneElements(),
      appState: { ...this.api.getAppState(), exportBackground: true },
      files: this.api.getFiles(),
    });
  }
}
