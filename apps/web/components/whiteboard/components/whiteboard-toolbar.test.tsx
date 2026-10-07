import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { WhiteboardLibrary } from './whiteboard-library';
import type { WhiteboardEngine } from '../canvas/whiteboard-engine';
describe('native whiteboard controls', () => {
  it('keeps locked drawing disabled and viewport controls available', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByRole('button', { name: 'Pan', exact: true })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Pan', exact: true }));
    expect(engine.setTool).toHaveBeenCalledWith('hand');
    await user.click(screen.getByRole('button', { name: 'View controls' }));
    await user.click(screen.getByRole('menuitem', { name: 'Zoom in', exact: true }));
    expect(engine.zoomBy).toHaveBeenCalledWith(0.1);
    await user.click(screen.getByRole('button', { name: 'View controls' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reset zoom to 100%' }));
    expect(engine.resetZoom).toHaveBeenCalledOnce();
  });
  it('shows essentials first and reveals shapes only when requested', async () => {
    const user = userEvent.setup();
    const engine = { setTool: vi.fn() } as unknown as WhiteboardEngine;
    const onTool = vi.fn();
    render(
      <WhiteboardToolbar
        engine={engine}
        editable
        tool="selection"
        onTool={onTool}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('menuitemradio', { name: 'Rectangle' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Clear board' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Rectangle' }));
    expect(engine.setTool).toHaveBeenCalledWith('rectangle');
    expect(onTool).toHaveBeenCalledWith('rectangle');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shapes' })).toHaveFocus();
  });
  it('keeps teacher actions hidden from students and preserves redo access', async () => {
    const user = userEvent.setup();
    const engine = { redo: vi.fn() } as unknown as WhiteboardEngine;
    render(
      <WhiteboardToolbar
        engine={engine}
        editable
        tool="selection"
        onTool={vi.fn()}
        onClear={vi.fn()}
        canClear={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'More whiteboard actions' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Clear board' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /Redo/ }));
    expect(engine.redo).toHaveBeenCalledOnce();
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
});
