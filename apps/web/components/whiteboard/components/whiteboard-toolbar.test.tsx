import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { WhiteboardLibrary } from './whiteboard-library';
import { WhiteboardPages } from './whiteboard-pages';
import type { WhiteboardEngine } from '../canvas/whiteboard-engine';
describe('native whiteboard controls', () => {
  it('keeps locked drawing disabled and viewport controls available', () => {
    const engine = {
      setTool: vi.fn(),
      zoomBy: vi.fn(),
      resetZoom: vi.fn(),
    } as unknown as WhiteboardEngine;
    render(
      <WhiteboardToolbar
        engine={engine}
        editable={false}
        tool="selection"
        onTool={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pen', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in', exact: true }));
    expect(engine.zoomBy).toHaveBeenCalledWith(0.1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }));
    expect(engine.resetZoom).toHaveBeenCalledOnce();
  });
  it('searches and inserts educational assets', () => {
    const insert = vi.fn();
    render(<WhiteboardLibrary disabled={false} onInsert={insert} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search educational assets' }), {
      target: { value: 'number' },
    });
    expect(
      screen.queryByRole('button', { name: 'Coordinate plane', exact: true }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Number line', exact: true }));
    expect(insert.mock.calls[0][0].id).toBe('math-number-line');
  });
  it('changes pages and protects the last page from deletion', () => {
    const select = vi.fn();
    render(
      <WhiteboardPages
        pages={[{ id: 'one', title: 'Page 1', elements: [] }]}
        activeId="one"
        teacher
        busy={false}
        onSelect={select}
        onAdd={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Delete page', exact: true }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Current page' }), {
      target: { value: 'one' },
    });
    expect(select).toHaveBeenCalledWith('one');
  });
});
