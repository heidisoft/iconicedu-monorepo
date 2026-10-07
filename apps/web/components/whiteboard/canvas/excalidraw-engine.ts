import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  exportToSvg,
  exportToBlob,
  restoreElements,
  newElementWith,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
import type { WhiteboardAsset } from '../assets/registry';
import type {
  WhiteboardEngine,
  WhiteboardTool,
  WhiteboardStyle,
} from './whiteboard-engine';
import { insidePolygon, eraseStroke, type Point } from './annotation-geometry';
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
    private readonly gridChanged?: (mode: 'none' | 'dots' | 'lines') => void,
  ) {}
  getStyle(): WhiteboardStyle {
    const state = this.api.getAppState();
    const selected = this.api
      .getSceneElements()
      .find((e) => state.selectedElementIds[e.id]);
    return {
      selectedType: selected?.type,
      strokeColor: selected?.strokeColor ?? state.currentItemStrokeColor,
      backgroundColor: selected?.backgroundColor ?? state.currentItemBackgroundColor,
      strokeWidth: selected?.strokeWidth ?? state.currentItemStrokeWidth,
      opacity: selected?.opacity ?? state.currentItemOpacity,
      fillStyle: selected?.fillStyle ?? state.currentItemFillStyle,
      fontSize: selected?.type === 'text' ? selected.fontSize : state.currentItemFontSize,
      fontFamily:
        selected?.type === 'text' ? selected.fontFamily : state.currentItemFontFamily,
      startArrowhead:
        selected?.type === 'arrow' || selected?.type === 'line'
          ? selected.startArrowhead
          : state.currentItemStartArrowhead,
      endArrowhead:
        selected?.type === 'arrow' || selected?.type === 'line'
          ? selected.endArrowhead
          : state.currentItemEndArrowhead,
      textAlign: (selected?.type === 'text'
        ? selected.textAlign
        : state.currentItemTextAlign) as WhiteboardStyle['textAlign'],
    };
  }
  setStyle(style: Partial<WhiteboardStyle>) {
    const current = this.getStyle();
    const next = { ...current, ...style };
    const selected = this.api.getAppState().selectedElementIds;
    const appState = {
      currentItemStrokeColor: next.strokeColor,
      currentItemBackgroundColor: next.backgroundColor,
      currentItemStrokeWidth: next.strokeWidth,
      currentItemOpacity: next.opacity,
      currentItemFillStyle: next.fillStyle,
      currentItemFontSize: next.fontSize,
      currentItemFontFamily: next.fontFamily as ReturnType<
        ExcalidrawImperativeAPI['getAppState']
      >['currentItemFontFamily'],
      currentItemStartArrowhead: next.startArrowhead as ReturnType<
        ExcalidrawImperativeAPI['getAppState']
      >['currentItemStartArrowhead'],
      currentItemEndArrowhead: next.endArrowhead as ReturnType<
        ExcalidrawImperativeAPI['getAppState']
      >['currentItemEndArrowhead'],
      currentItemTextAlign: next.textAlign,
    };
    if (!Object.values(selected).some(Boolean)) {
      this.api.updateScene({ appState });
      return;
    }
    this.commit();
    this.transact(() =>
      this.api.updateScene({
        appState,
        elements: restoreElements(
          this.api.getSceneElementsIncludingDeleted().map((e) => {
            // Bound labels participate in text formatting when their container is selected.
            const target =
              selected[e.id] ||
              (e.type === 'text' && e.containerId && selected[e.containerId]);
            if (!target || e.isDeleted || e.locked) return e;
            const {
              fontSize,
              fontFamily,
              textAlign,
              startArrowhead,
              endArrowhead,
              ...drawing
            } = style;
            return e.type === 'text'
              ? newElementWith(e, {
                  ...drawing,
                  ...(fontSize === undefined ? {} : { fontSize }),
                  ...(fontFamily === undefined
                    ? {}
                    : { fontFamily: fontFamily as typeof e.fontFamily }),
                  ...(textAlign === undefined ? {} : { textAlign }),
                })
              : e.type === 'arrow' || e.type === 'line'
                ? newElementWith(e, {
                    ...drawing,
                    ...(startArrowhead === undefined
                      ? {}
                      : { startArrowhead: startArrowhead as typeof e.startArrowhead }),
                    ...(endArrowhead === undefined
                      ? {}
                      : { endArrowhead: endArrowhead as typeof e.endArrowhead }),
                  })
                : newElementWith(e, drawing);
          }),
          null,
          { refreshDimensions: true },
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      }),
    );
  }
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
  private toolStyles = new Map<WhiteboardTool, WhiteboardStyle>();
  setTool(tool: WhiteboardTool) {
    if (
      !['selection', 'hand', 'eraser', 'laser', 'lasso', 'pixel-eraser'].includes(
        this.lastTool,
      )
    )
      this.toolStyles.set(this.lastTool, this.getStyle());
    const saved = this.toolStyles.get(tool);
    if (tool !== 'selection')
      this.api.updateScene({
        appState: { selectedElementIds: {}, selectedGroupIds: {} },
      });
    this.api.setActiveTool({
      type:
        tool === 'highlighter'
          ? 'freedraw'
          : tool === 'lasso' || tool === 'pixel-eraser'
            ? 'selection'
            : tool,
    });
    this.api.updateScene({ appState: { openMenu: null } });
    if (saved)
      this.api.updateScene({
        appState: {
          currentItemStrokeColor: saved.strokeColor,
          currentItemBackgroundColor: saved.backgroundColor,
          currentItemStrokeWidth: saved.strokeWidth,
          currentItemOpacity: saved.opacity,
          currentItemFillStyle: saved.fillStyle,
          currentItemFontSize: saved.fontSize,
          currentItemFontFamily: saved.fontFamily as ReturnType<
            ExcalidrawImperativeAPI['getAppState']
          >['currentItemFontFamily'],
          currentItemStartArrowhead: saved.startArrowhead as ReturnType<
            ExcalidrawImperativeAPI['getAppState']
          >['currentItemStartArrowhead'],
          currentItemEndArrowhead: saved.endArrowhead as ReturnType<
            ExcalidrawImperativeAPI['getAppState']
          >['currentItemEndArrowhead'],
          currentItemTextAlign: saved.textAlign,
        },
      });
    else if (tool === 'highlighter' || this.lastTool === 'highlighter')
      this.api.updateScene({
        appState: {
          currentItemOpacity: tool === 'highlighter' ? 35 : 100,
          currentItemStrokeWidth: tool === 'highlighter' ? 8 : 2,
        },
      });
    this.lastTool = tool;
  }
  selectLasso(points: Point[]) {
    const selected = this.api
      .getSceneElements()
      .filter(
        (e) =>
          !e.locked && insidePolygon([e.x + e.width / 2, e.y + e.height / 2], points),
      );
    this.api.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(selected.map((e) => [e.id, true])),
        openMenu: 'shape',
      },
    });
  }
  erasePixels(point: Point, radius: number) {
    const elements = this.api.getSceneElementsIncludingDeleted();
    const next: ExcalidrawElement[] = [];
    let changed = false;
    for (const e of elements) {
      if (e.type !== 'freedraw' || e.isDeleted || e.locked) {
        next.push(e);
        continue;
      }
      const cx = e.x + e.width / 2,
        cy = e.y + e.height / 2;
      const world: Point[] = e.points.map(([px, py]) => {
        const dx = e.x + px - cx,
          dy = e.y + py - cy;
        return [
          cx + dx * Math.cos(e.angle) - dy * Math.sin(e.angle),
          cy + dx * Math.sin(e.angle) + dy * Math.cos(e.angle),
        ];
      });
      const paths = eraseStroke(world, point, radius + e.strokeWidth / 2);
      if (paths.length === 1 && JSON.stringify(paths[0]) === JSON.stringify(world)) {
        next.push(e);
        continue;
      }
      changed = true;
      next.push(newElementWith(e, { isDeleted: true }));
      for (const path of paths) {
        const x = Math.min(...path.map((p) => p[0])),
          y = Math.min(...path.map((p) => p[1]));
        next.push(
          newElementWith(
            { ...e, id: crypto.randomUUID(), index: null },
            {
              x,
              y,
              angle: 0,
              width: Math.max(...path.map((p) => p[0])) - x,
              height: Math.max(...path.map((p) => p[1])) - y,
              points: path.map((p) => [p[0] - x, p[1] - y]),
              pressures: [],
              simulatePressure: true,
              isDeleted: false,
            },
          ),
        );
      }
    }
    if (changed)
      this.api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.NEVER });
  }
  insertNote() {
    const state = this.api.getAppState();
    const x = state.width / 2 / state.zoom.value - state.scrollX - 100;
    const y = state.height / 2 / state.zoom.value - state.scrollY - 90;
    const elements = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x,
        y,
        width: 200,
        height: 180,
        backgroundColor: '#fff3bf',
        strokeColor: '#e9c46a',
        fillStyle: 'solid',
        roughness: 0,
        label: { text: 'Double-click to edit', fontSize: 20, fontFamily: 2 },
      },
    ]);
    this.transact(() =>
      this.api.updateScene({
        elements: [...this.api.getSceneElementsIncludingDeleted(), ...elements],
        appState: {
          selectedElementIds: Object.fromEntries(elements.map((e) => [e.id, true])),
          openMenu: 'shape',
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      }),
    );
    this.api.setActiveTool({ type: 'selection' });
  }
  insertStamp(text: string) {
    this.insertAsset({
      id: 'stamp',
      name: 'Stamp',
      category: 'Annotations',
      tags: [],
      width: 48,
      height: 48,
      primitives: [{ type: 'text', x: 0, y: 0, text, size: 40 }],
    });
    this.api.setActiveTool({ type: 'selection' });
  }
  setGrid(mode: 'none' | 'dots' | 'lines', snap: boolean) {
    this.api.updateScene({
      appState: { gridSize: 24, gridModeEnabled: snap },
    });
    // Grid appearance is local UI state; snapping remains owned by the canvas engine.
    this.gridChanged?.(mode);
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
  exportPng() {
    return exportToBlob({
      elements: this.api.getSceneElements(),
      appState: {
        ...this.api.getAppState(),
        viewBackgroundColor: '#ffffff',
        exportBackground: true,
      },
      files: this.api.getFiles(),
      mimeType: 'image/png',
    });
  }
  exportSvg() {
    return exportToSvg({
      elements: this.api.getSceneElements(),
      appState: { ...this.api.getAppState(), exportBackground: true },
      files: this.api.getFiles(),
    });
  }
}
