import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeAnnotationToolbar } from './native-annotation-toolbar';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white' } }),
}));
it('matches the web annotation order and groups shapes, stamps and attention tools', () => {
  const onTool = jest.fn();
  const screen = render(
    <NativeAnnotationToolbar
      tool="pen"
      editable
      onTool={onTool}
      onUndo={jest.fn()}
      onRedo={jest.fn()}
      canUndo
      canRedo
      onOptions={jest.fn()}
    />,
  );
  expect(
    screen.getAllByRole('button').map((button) => button.props.accessibilityLabel),
  ).toEqual([
    'Pan',
    'Laser pointer',
    'Select',
    'Pen',
    'Text',
    'Eraser',
    'Undo annotation',
    'More annotation actions',
  ]);
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  fireEvent.press(screen.getByLabelText('Shapes'));
  fireEvent.press(screen.getByLabelText('Double arrow'));
  expect(onTool).toHaveBeenLastCalledWith('doubleArrow');
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  fireEvent.press(screen.getByLabelText('Stamps'));
  fireEvent.press(screen.getByLabelText('Star'));
  expect(onTool).toHaveBeenLastCalledWith('stampStar');
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  fireEvent.press(screen.getByLabelText('Attention'));
  fireEvent.press(screen.getByLabelText('Named pointer'));
  expect(onTool).toHaveBeenLastCalledWith('pointerArrow');
});

it('uses the drawing surface size to expose shortcuts without changing compact tools', () => {
  const props = {
    tool: 'pen' as const,
    editable: true,
    onTool: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    canUndo: true,
    canRedo: true,
    onOptions: jest.fn(),
  };
  const screen = render(
    <NativeAnnotationToolbar {...props} availableWidth={1024} availableHeight={768} />,
  );
  fireEvent.press(screen.getByLabelText('Highlighter'));
  expect(props.onTool).toHaveBeenCalledWith('highlighter');
  screen.rerender(
    <NativeAnnotationToolbar {...props} availableWidth={390} availableHeight={844} />,
  );
  expect(screen.queryByLabelText('Highlighter')).toBeNull();
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  expect(screen.getByLabelText('Highlighter')).toBeTruthy();
});
