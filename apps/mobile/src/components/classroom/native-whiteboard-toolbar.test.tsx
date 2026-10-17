import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeWhiteboardToolbar } from './native-whiteboard-toolbar';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white' } }),
}));
it('matches web tool order and sends the selected canvas commands', () => {
  const onCommand = jest.fn();
  const screen = render(
    <NativeWhiteboardToolbar
      ready
      editable
      canClear
      onCommand={onCommand}
      onClear={jest.fn()}
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
    'Shapes',
    'Library',
    'Undo',
    'View controls',
    'More whiteboard actions',
  ]);
  fireEvent.press(screen.getByLabelText('Shapes'));
  fireEvent.press(screen.getByLabelText('Diamond'));
  expect(onCommand).toHaveBeenLastCalledWith({ type: 'tool', tool: 'diamond' });
  fireEvent.press(screen.getByLabelText('View controls'));
  fireEvent.press(screen.getByLabelText('Fit content'));
  expect(onCommand).toHaveBeenLastCalledWith({ type: 'fit' });
  fireEvent.press(screen.getByLabelText('Snap to grid'));
  expect(onCommand).toHaveBeenLastCalledWith({ type: 'grid', grid: 'dots', snap: true });
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  fireEvent.press(screen.getByLabelText('Redo'));
  expect(onCommand).toHaveBeenLastCalledWith({ type: 'redo' });
});
it('preserves view-only permissions while allowing pan and view controls', () => {
  const screen = render(
    <NativeWhiteboardToolbar
      ready
      editable={false}
      canClear={false}
      onCommand={jest.fn()}
      onClear={jest.fn()}
    />,
  );
  expect(screen.getByLabelText('Pen')).toBeDisabled();
  expect(screen.getByLabelText('Pan')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.queryByLabelText('Clear board')).toBeNull();
});

it('edits selected shapes with the same contextual stroke and fill controls as web', () => {
  const onCommand = jest.fn();
  const screen = render(
    <NativeWhiteboardToolbar
      ready
      editable
      canClear
      onCommand={onCommand}
      onClear={jest.fn()}
      styleState={{
        tool: 'selection',
        selectionType: 'rectangle',
        color: '#1971c2',
        width: 2,
        fill: 'transparent',
      }}
    />,
  );
  fireEvent.press(screen.getByLabelText('Thick stroke'));
  expect(onCommand).toHaveBeenLastCalledWith({
    type: 'style',
    style: { strokeWidth: 4 },
  });
  fireEvent.press(screen.getByLabelText('Fill shape'));
  expect(onCommand).toHaveBeenLastCalledWith({
    type: 'style',
    style: { backgroundColor: '#1971c2' },
  });
});
