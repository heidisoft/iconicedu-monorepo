import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ExcalidrawCanvas } from './excalidraw-canvas';
const { api, state } = vi.hoisted(() => {
  const state = {
    activeTool: { type: 'selection' },
    width: 800,
    height: 600,
    zoom: { value: 1 },
    scrollX: 0,
    scrollY: 0,
    currentItemStrokeColor: '#1e293b',
  };
  return {
    state,
    api: {
      getAppState: () => state,
      getSceneElements: () => [],
      getSceneElementsIncludingDeleted: () => [],
      updateScene: vi.fn(({ appState }: { appState?: Record<string, unknown> }) => {
        Object.assign(state, appState);
        // Excalidraw resets its active tool when view mode is initialized/changed.
        if (appState && 'viewModeEnabled' in appState)
          state.activeTool = { type: 'selection' };
      }),
      setActiveTool: vi.fn(({ type }: { type: string }) => {
        state.activeTool = { type };
      }),
    },
  };
});
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('./use-whiteboard-laser', () => ({ useWhiteboardLaser: () => vi.fn() }));
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { NEVER: 'NEVER' },
  restoreElements: (elements: unknown) => elements,
  convertToExcalidrawElements: vi.fn(),
  exportToSvg: vi.fn(),
  exportToBlob: vi.fn(),
  newElementWith: vi.fn(),
  Excalidraw: ({ excalidrawAPI }: { excalidrawAPI: (api: unknown) => void }) => {
    useEffect(() => excalidrawAPI(api), [excalidrawAPI]);
    return <div />;
  },
}));
beforeEach(() => {
  state.activeTool = { type: 'selection' };
  vi.clearAllMocks();
});
const props = {
  elements: [],
  tool: 'laser' as const,
  onChange: vi.fn(),
  onEngine: vi.fn(),
  onToolChange: vi.fn(),
};
it('activates the default laser after initializing edit mode', async () => {
  render(<ExcalidrawCanvas {...props} editable />);
  await waitFor(() => expect(state.activeTool.type).toBe('laser'));
});
it('activates the laser when editing permission arrives after mounting', async () => {
  const view = render(<ExcalidrawCanvas {...props} editable={false} />);
  view.rerender(<ExcalidrawCanvas {...props} editable />);
  await waitFor(() => expect(state.activeTool.type).toBe('laser'));
});
