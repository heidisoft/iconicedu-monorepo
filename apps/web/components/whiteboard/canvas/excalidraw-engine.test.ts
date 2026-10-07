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
    currentItemStrokeColor: '#1e1e1e',
    currentItemBackgroundColor: 'transparent',
    currentItemStrokeWidth: 2,
    currentItemOpacity: 100,
    currentItemFillStyle: 'solid',
    currentItemFontSize: 20,
    currentItemFontFamily: 2,
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: 'arrow',
    currentItemTextAlign: 'left',
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
  it('does not restyle a selected object when choosing a pen variant for new strokes', () => {
    const { engine } = fixture();
    engine.insertNote();
    const original = engine.getElements();
    engine.setTool('freedraw');
    engine.setStyle({ strokeWidth: 6, opacity: 100, strokeColor: '#1971c2' });
    expect(engine.getElements()).toEqual(original);
    expect(engine.getStyle().strokeWidth).toBe(6);
  });
  it('restores each drawing tool color when switching tools', () => {
    const { engine } = fixture();
    engine.setTool('freedraw');
    engine.setStyle({ strokeColor: '#e03131' });
    engine.setTool('text');
    engine.setStyle({ strokeColor: '#1971c2' });
    engine.setTool('freedraw');
    expect(engine.getStyle().strokeColor).toBe('#e03131');
    engine.setTool('text');
    expect(engine.getStyle().strokeColor).toBe('#1971c2');
  });
  it('inserts an editable bound note and a stamp through normal scene transactions', () => {
    const { engine, api, changed } = fixture();
    engine.insertNote();
    const note = engine.getElements();
    expect(note).toHaveLength(2);
    const shape = note.find((e) => e.data.type === 'rectangle')!;
    const text = note.find((e) => e.data.type === 'text')!;
    expect(text.data.containerId).toBe(shape.id);
    expect(shape.data.boundElements).toEqual([{ id: text.id, type: 'text' }]);
    engine.insertStamp('★');
    expect(engine.getElements().some((e) => e.data.text === '★')).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'selection' });
    engine.undo();
    expect(engine.getElements().filter((e) => !e.deleted)).toHaveLength(2);
  });
  it('enables grid snapping without modifying document elements', () => {
    const { engine, api } = fixture();
    engine.setGrid('lines', true);
    expect(api.updateScene).toHaveBeenLastCalledWith({
      appState: { gridSize: 24, gridModeEnabled: true },
    });
    expect(engine.getElements()).toEqual([]);
  });
  it('opens contextual options without resetting ordinary drawing styles', () => {
    const { engine, api } = fixture();
    engine.setTool('freedraw');
    expect(api.updateScene).toHaveBeenLastCalledWith({ appState: { openMenu: null } });
    engine.setTool('rectangle');
    expect(api.updateScene).toHaveBeenLastCalledWith({ appState: { openMenu: null } });
    engine.setTool('hand');
    expect(api.updateScene).toHaveBeenLastCalledWith({ appState: { openMenu: null } });
    engine.setTool('highlighter');
    expect(api.updateScene).toHaveBeenLastCalledWith({
      appState: { currentItemOpacity: 35, currentItemStrokeWidth: 8 },
    });
    engine.setTool('freedraw');
    expect(api.updateScene).toHaveBeenLastCalledWith({
      appState: expect.objectContaining({
        currentItemOpacity: 100,
        currentItemStrokeWidth: 2,
      }),
    });
  });
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
