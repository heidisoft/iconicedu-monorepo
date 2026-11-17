import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeFocusedVideo } from './native-focused-video';
jest.mock('./native-video-view', () => ({ NativeVideoView: () => null }));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { bg: 'white', text: 'black' } }),
}));
it('sizes expanded sharing to the available content area when orientation changes', () => {
  const close = jest.fn();
  const screen = render(
    <NativeFocusedVideo
      user={{
        id: '1',
        name: 'Test host',
        host: true,
        cohost: false,
        muted: true,
        video: false,
      }}
      sharing
      onClose={close}
      shareContent={(height) => <Text>{`Share height ${height}`}</Text>}
    />,
  );
  fireEvent(screen.getByTestId('focused-share-content'), 'layout', {
    nativeEvent: { layout: { width: 1000, height: 300 } },
  });
  expect(screen.getByText('Share height 300')).toBeTruthy();
  fireEvent(screen.getByTestId('focused-share-content'), 'layout', {
    nativeEvent: { layout: { width: 400, height: 680 } },
  });
  expect(screen.getByText('Share height 680')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Collapse shared screen'));
  expect(close).toHaveBeenCalledTimes(1);
});
