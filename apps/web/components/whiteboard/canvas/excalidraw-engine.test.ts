import { describe, it, expect, vi } from 'vitest';
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'FontFace', {
    configurable: true,
    value: class {
      status = 'loaded';
      family = 'test';
      load() {
        return Promise.resolve(this);
      }
    },
  });
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { add: () => {}, check: () => true, load: () => Promise.resolve([]) },
  });
  HTMLCanvasElement.prototype.getContext = (() => ({
    filter: 'none',
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 3,
    }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
import { ExcalidrawWhiteboardEngine, wrapCanvasElements } from './excalidraw-engine';
import { educationalAssets } from '../assets/registry';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
function fixture() {
  let elements: ExcalidrawElement[] = [];
  let state = {
    width: 800,
    height: 600,
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    selectedElementIds: {} as Record<string, boolean>,
  };
  const api = {
    getSceneElementsIncludingDeleted: () => elements,
    getSceneElements: () => elements.filter((e) => !e.isDeleted),
    getAppState: () => state,
    updateScene: vi.fn(
      ({
        elements: next,
        appState,
      }: {
        elements?: ExcalidrawElement[];
        appState?: typeof state;
      }) => {
        if (next) elements = next;
        if (appState) state = { ...state, ...appState };
      },
    ),
    setActiveTool: vi.fn(),
    scrollToContent: vi.fn(),
    getFiles: () => ({}),
  };
  const changed = vi.fn();
  return {
    api,
    changed,
    engine: new ExcalidrawWhiteboardEngine(
      api as unknown as ExcalidrawImperativeAPI,
      changed,
    ),
  };
}
describe('Excalidraw canvas adapter', () => {
  it('converts neutral assets into grouped selected canvas elements', () => {
    const { engine, api } = fixture();
    engine.insertAsset(educationalAssets.get('math-number-line'));
    const elements = engine.getElements();
    expect(elements.length).toBeGreaterThan(10);
    expect(Object.keys(api.getAppState().selectedElementIds)).toHaveLength(
      elements.length,
    );
    expect(elements[0].data.x).toBe(220);
    expect(elements[0].data.roughness).toBe(0);
    const grid = fixture();
    grid.engine.insertAsset(educationalAssets.get('math-graph-paper'));
    expect(grid.engine.getElements()[0].data.height).toBe(300);
    expect(grid.engine.getElements()[0].data.width).toBe(0);
  });
  it('exports/imports a scene, deletes selection and clears with undo support', () => {
    const { engine, changed } = fixture();
    engine.insertAsset(educationalAssets.get('math-number-line'));
    const initial = engine.getElements();
    expect(JSON.parse(engine.exportScene()).elements).toEqual(initial);
    engine.deleteSelection();
    expect(engine.getElements().every((e) => e.deleted)).toBe(true);
    engine.undo();
    expect(engine.getElements().some((e) => !e.deleted)).toBe(true);
    engine.clear();
    expect(engine.getElements().every((e) => e.deleted)).toBe(true);
    expect(changed).toHaveBeenCalled();
  });
  it('imports remote changes without treating them as local undo history', () => {
    const { engine } = fixture();
    engine.insertAsset(educationalAssets.get('math-graph-paper'));
    const elements = engine.getElements();
    const fresh = fixture();
    fresh.engine.importScene(elements);
    fresh.engine.undo();
    expect(fresh.engine.getElements().filter((e) => !e.deleted)).toHaveLength(
      elements.length,
    );
    expect(wrapCanvasElements(fresh.api.getSceneElements()).length).toBe(elements.length);
  });
});
