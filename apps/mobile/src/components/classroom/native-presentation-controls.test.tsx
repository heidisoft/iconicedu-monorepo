import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativePresentationControls } from './native-presentation-controls';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white', border: 'gray' } }),
}));
it('keeps fullscreen and annotation permissions directly accessible beside the share', () => {
  const onFullscreen = jest.fn(),
    onToggleAnnotations = jest.fn();
  const screen = render(
    <NativePresentationControls
      onFullscreen={onFullscreen}
      annotationsEnabled
      onToggleAnnotations={onToggleAnnotations}
    />,
  );
  fireEvent.press(screen.getByLabelText('Expand shared screen to full screen'));
  fireEvent.press(screen.getByLabelText('Disable participant annotations'));
  expect(onFullscreen).toHaveBeenCalledTimes(1);
  expect(onToggleAnnotations).toHaveBeenCalledTimes(1);
  screen.rerender(
    <NativePresentationControls
      expanded
      onFullscreen={onFullscreen}
      annotationsEnabled={false}
      onToggleAnnotations={onToggleAnnotations}
    />,
  );
  fireEvent.press(screen.getByLabelText('Collapse shared screen'));
  fireEvent.press(screen.getByLabelText('Allow participant annotations'));
  expect(onFullscreen).toHaveBeenCalledTimes(2);
  expect(onToggleAnnotations).toHaveBeenCalledTimes(2);
});
it('does not expose moderation actions to participants without permission', () => {
  const screen = render(<NativePresentationControls onFullscreen={jest.fn()} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByLabelText('Allow participant annotations')).toBeNull();
});
