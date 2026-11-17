import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DrawingStyleStrip } from '@iconicedu/ui-native';

it('closes and reopens drawing styles without discarding the color or fill', () => {
  const onClose = jest.fn(),
    onStyle = jest.fn();
  const screen = render(
    <DrawingStyleStrip
      color="#123456"
      width={2}
      fill="#1971c2"
      showFill
      foreground="#000000"
      onMore={jest.fn()}
      onStyle={onStyle}
      onClose={onClose}
    />,
  );
  fireEvent.press(screen.getByLabelText('Close drawing styles'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Stroke color #123456')).toBeNull();
  fireEvent.press(screen.getByLabelText('Show drawing styles'));
  expect(
    screen.getByLabelText('Stroke color #123456').props.accessibilityState.selected,
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Remove fill'));
  expect(onStyle).toHaveBeenCalledWith({ backgroundColor: 'transparent' });
});

it('keeps color slots in place when selecting another color', () => {
  const props = {
    color: '#e03131',
    width: 2,
    foreground: 'black',
    onMore: jest.fn(),
    onStyle: jest.fn(),
  };
  const screen = render(<DrawingStyleStrip {...props} />);
  const order = () =>
    screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label: string) => label.startsWith('Stroke color'));
  const before = order();
  screen.rerender(<DrawingStyleStrip {...props} color="#1971c2" />);
  expect(order()).toEqual(before);
  expect(
    screen.getByLabelText('Stroke color #1971c2').props.accessibilityState.selected,
  ).toBe(true);
});
