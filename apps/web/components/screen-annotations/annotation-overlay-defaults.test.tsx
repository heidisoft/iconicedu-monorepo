import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AnnotationOverlay } from './annotation-overlay';
import type { useScreenAnnotations } from './use-screen-annotations';

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Transformer: () => null,
}));
vi.mock('./annotation-shape', () => ({
  AnnotationShape: () => null,
  annotationGeometry: vi.fn(),
}));
vi.mock('./annotation-pointer', () => ({ AnnotationPointer: () => null }));
vi.mock('./use-screen-annotations', () => ({ useScreenAnnotations: vi.fn() }));
vi.mock('./annotation-toolbar', () => ({
  AnnotationToolbar: ({
    tool,
    setTool,
  }: {
    tool: string;
    setTool: (tool: string) => void;
  }) => (
    <>
      <output data-testid="annotation-tool">{tool}</output>
      <button onClick={() => setTool('pen')}>Choose pen</button>
    </>
  ),
}));
it('defaults to laser after permissions load, preserves the chosen tool, and resets on a new share', () => {
  const engine = {
    canDraw: false,
    context: null,
    objects: [],
    remoteDrafts: [],
    vanishing: [],
    pointers: {},
    lasers: [],
    historyCount: { undo: 0, redo: 0 },
    execute: vi.fn(),
    changeHistory: vi.fn(),
    error: null,
  };
  const useAnnotations = (() => engine) as unknown as typeof useScreenAnnotations;
  const view = (shareKey = 'peer-one') => (
    <AnnotationOverlay
      sessionId="session"
      shareKey={shareKey}
      width={800}
      height={600}
      useAnnotations={useAnnotations}
    />
  );
  const { rerender } = render(view());
  expect(screen.getByTestId('annotation-tool')).toHaveTextContent('cursor');
  engine.canDraw = true;
  rerender(view());
  expect(screen.getByTestId('annotation-tool')).toHaveTextContent('vanishingPen');
  fireEvent.click(screen.getByRole('button', { name: 'Choose pen' }));
  rerender(view());
  expect(screen.getByTestId('annotation-tool')).toHaveTextContent('pen');
  rerender(view('peer-two'));
  expect(screen.getByTestId('annotation-tool')).toHaveTextContent('vanishingPen');
  engine.canDraw = false;
  rerender(view('peer-two'));
  expect(screen.getByTestId('annotation-tool')).toHaveTextContent('cursor');
});
