import React from 'react';
import { Text } from 'react-native';
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
    'Undo',
    'More whiteboard actions',
  ]);
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  fireEvent.press(screen.getByLabelText('Shapes'));
  fireEvent.press(screen.getByLabelText('Diamond'));
  expect(onCommand).toHaveBeenLastCalledWith({ type: 'tool', tool: 'diamond' });
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
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
it('keeps Follow tutor and More in the toolbar while their options stay in menus', () => {
  const follow = jest.fn();
  const screen = render(
    <NativeWhiteboardToolbar
      ready
      editable
      canClear
      onCommand={jest.fn()}
      onClear={jest.fn()}
      onFollow={follow}
      moreContent={<Text>Saved</Text>}
    />,
  );
  expect(screen.queryByText('Saved')).toBeNull();
  expect(screen.queryByText('Follow tutor')).toBeNull();
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  fireEvent.press(screen.getByLabelText('Focus tutor'));
  expect(follow).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.getByText('Saved')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close More whiteboard actions'));
  expect(screen.queryByText('Saved')).toBeNull();
});

it('toggles the picker from the selected tool and preserves closure across style updates', () => {
  const props = {
    ready: true,
    editable: true,
    canClear: false,
    onCommand: jest.fn(),
    onClear: jest.fn(),
    styleState: {
      tool: 'freedraw' as const,
      color: '#e03131',
      width: 2,
      fill: 'transparent',
    },
  };
  const screen = render(<NativeWhiteboardToolbar {...props} />);
  fireEvent.press(screen.getByLabelText('Pen'));
  expect(screen.queryByLabelText('Close drawing styles')).toBeNull();
  fireEvent.press(screen.getByLabelText('Pen'));
  expect(screen.getByLabelText('Close drawing styles')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close drawing styles'));
  screen.rerender(
    <NativeWhiteboardToolbar {...props} styleState={{ ...props.styleState, width: 4 }} />,
  );
  expect(screen.queryByLabelText('Close drawing styles')).toBeNull();
  fireEvent.press(screen.getByLabelText('Text'));
  expect(screen.getByLabelText('Close drawing styles')).toBeTruthy();
});

it('exposes extra shortcuts only when the drawing surface has enough room', () => {
  const props = {
    ready: true,
    editable: true,
    canClear: true,
    onCommand: jest.fn(),
    onClear: jest.fn(),
  };
  const screen = render(
    <NativeWhiteboardToolbar {...props} availableWidth={1024} availableHeight={768} />,
  );
  expect(screen.getByLabelText('Shapes')).toBeTruthy();
  expect(screen.getByLabelText('Library')).toBeTruthy();
  expect(screen.getByLabelText('Redo')).toBeTruthy();
  screen.rerender(
    <NativeWhiteboardToolbar {...props} availableWidth={390} availableHeight={844} />,
  );
  expect(screen.queryByLabelText('Shapes')).toBeNull();
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.getByLabelText('Shapes')).toBeTruthy();
});
