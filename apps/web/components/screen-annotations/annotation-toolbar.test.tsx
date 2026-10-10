import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationToolbar } from './annotation-toolbar';
import type { ComponentProps } from 'react';

function setup(overrides: Partial<ComponentProps<typeof AnnotationToolbar>> = {}) {
  const props: ComponentProps<typeof AnnotationToolbar> = {
    tool: 'cursor',
    setTool: vi.fn(),
    canDraw: true,
    tutor: true,
    studentsEnabled: true,
    onPermissions: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    undoCount: 1,
    redoCount: 0,
    clear: vi.fn(),
    color: '#ef4444',
    setColor: vi.fn(),
    width: 3,
    setWidth: vi.fn(),
    opacity: 1,
    setOpacity: vi.fn(),
    fontSize: 24,
    setFontSize: vi.fn(),
    bold: false,
    setBold: vi.fn(),
    italic: false,
    setItalic: vi.fn(),
    onFormat: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onSave: vi.fn(),
    showNames: false,
    setShowNames: vi.fn(),
    pressure: false,
    setPressure: vi.fn(),
    ...overrides,
  };
  render(<AnnotationToolbar {...props} />);
  return props;
}
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => localStorage.clear());
describe('screen annotation toolbar', () => {
  it('starts with a pen launcher, opens drawing tools, and closes into pointer mode', () => {
    const props = setup();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    click('Open annotation toolbar');
    expect(props.setTool).toHaveBeenLastCalledWith('pen');
    const primary = within(screen.getByRole('group', { name: 'Drawing tools' }));
    expect(
      primary.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Pointer',
      'Select',
      'Pen',
      'Vanishing pen',
      'Highlighter',
      'Text',
      'Eraser',
    ]);
    click('Close annotation toolbar');
    expect(props.setTool).toHaveBeenLastCalledWith('cursor');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open annotation toolbar' })).toHaveFocus();
  });
  it('uses compact icon controls and a horizontal scrolling toolbar', () => {
    setup();
    click('Open annotation toolbar');
    const toolbar = screen.getByRole('toolbar', { name: 'Screen annotations' });
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(toolbar).toHaveClass(
      'overflow-x-auto',
      'flex-nowrap',
      'rounded-full',
      'bg-card',
      'shadow-sm',
    );
    const pen = screen.getByRole('button', { name: 'Pen', exact: true });
    expect(pen).toHaveClass('size-8', 'rounded-full');
    expect(pen.querySelector('svg')).toHaveAttribute('width', '16');
    expect(pen.querySelector('span')).toHaveClass('sr-only');
    const drawingTools = screen.getByRole('group', {
      name: 'Drawing tools',
      exact: true,
    });
    const buttons = Array.from(drawingTools.querySelectorAll('button'));
    expect(buttons[buttons.indexOf(pen) + 1]).toHaveAccessibleName('Vanishing pen');
    expect(screen.getByRole('button', { name: 'Shapes', exact: true })).toHaveClass(
      'h-8',
      'w-11',
      'rounded-full',
    );

    click('Shapes');
    const shape = screen.getByRole('button', { name: 'Rectangle', exact: true });
    expect(shape).toHaveClass('min-h-11');
    expect(shape.querySelector('span')).not.toHaveClass('sr-only');
  });
  it('groups every advanced tool, closes a group after selection, and shows its active state', () => {
    const props = setup({ tool: 'ellipseFilled' });
    click('Open annotation toolbar');
    expect(screen.getByRole('button', { name: 'Shapes', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    click('Shapes');
    expect(screen.getByRole('group', { name: 'Shapes', exact: true })).toBeVisible();
    click('Stamps');
    expect(
      screen.queryByRole('group', { name: 'Shapes', exact: true }),
    ).not.toBeInTheDocument();
    click('Star');
    expect(props.setTool).toHaveBeenLastCalledWith('stampStar');
    expect(
      screen.queryByRole('group', { name: 'Stamps', exact: true }),
    ).not.toBeInTheDocument();
    click('Vanishing pen');
    expect(props.setTool).toHaveBeenLastCalledWith('vanishingPen');
  });
  it('organizes panels into compact labeled sections and marks the selected color', () => {
    setup();
    click('Open annotation toolbar');
    click('Format');
    for (const name of ['Color', 'Stroke', 'Text', 'Pen']) {
      expect(screen.getByRole('group', { name, exact: true })).toBeVisible();
    }
    expect(screen.getByRole('button', { name: 'Color #ef4444' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    click('Shapes');
    for (const name of [
      'Lines and arrows',
      'Outline shapes',
      'Filled shapes',
      'Highlights',
    ]) {
      expect(screen.getByRole('group', { name, exact: true })).toBeVisible();
    }
    click('More');
    for (const name of ['Selection', 'Board', 'Sharing and view']) {
      expect(screen.getByRole('group', { name, exact: true })).toBeVisible();
    }
  });
  it('keeps permission restrictions on primary and grouped tools and history', () => {
    const props = setup({ canDraw: false, tutor: false });
    click('Open annotation toolbar');
    expect(props.setTool).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pointer', exact: true })).toBeEnabled();
    for (const name of [
      'Select',
      'Pen',
      'Vanishing pen',
      'Highlighter',
      'Text',
      'Eraser',
      'Undo',
      'Redo',
    ]) {
      expect(screen.getByRole('button', { name, exact: true })).toBeDisabled();
    }
    click('Shapes');
    expect(screen.getByRole('button', { name: 'Rectangle', exact: true })).toBeDisabled();
    click('More');
    expect(
      screen.queryByRole('checkbox', { name: 'Allow participants to annotate' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled();
  });
  it('dismisses panels before collapsing, and preserves formatting and moderation actions', () => {
    const props = setup();
    click('Open annotation toolbar');
    click('Format');
    fireEvent.change(screen.getByLabelText('Annotation color'), {
      target: { value: '#3b82f6' },
    });
    expect(props.setColor).toHaveBeenCalledWith('#3b82f6');
    fireEvent.keyDown(screen.getByLabelText('Annotation color'), { key: 'Escape' });
    expect(screen.queryByLabelText('Annotation color')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close annotation toolbar' }),
    ).toBeVisible();
    click('More');
    click('Clear all');
    expect(props.clear).toHaveBeenCalledWith('all');
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Allow participants to annotate' }),
    );
    expect(props.onPermissions).toHaveBeenCalledWith(false);
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('group', { name: 'More', exact: true }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'Escape' });
    expect(props.setTool).toHaveBeenLastCalledWith('cursor');
  });
});
