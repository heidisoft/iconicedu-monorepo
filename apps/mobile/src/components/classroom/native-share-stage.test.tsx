import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeShareStage } from './native-share-stage';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: { text: 'black', card: 'white', action: 'green', actionForeground: 'white' },
  }),
}));
const mockWidth = jest.fn();
const mockZoom = {
  session: {
    getMySelf: async () => ({ userId: '1' }),
    getRemoteUsers: async () => [{ userId: '2' }],
  },
};
jest.mock('@zoom/react-native-videosdk', () => ({
  useZoom: () => mockZoom,
  VideoAspect: { LetterBox: 0 },
  ZoomVideoSdkUser: function () {
    return { shareStatisticInfo: { getWidth: mockWidth, getHeight: async () => 720 } };
  },
}));
jest.mock('./native-video-view', () => ({ NativeVideoView: () => null }));
jest.mock('./native-screen-annotations', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    NativeScreenAnnotations: ({
      shareKey,
      active,
      onToggle,
    }: {
      shareKey: string;
      active: boolean;
      onToggle?: () => void;
    }) => (
      <View>
        <Text testID="annotations">{shareKey}</Text>
        {onToggle && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              active ? 'Close annotation toolbar' : 'Open annotation toolbar'
            }
            onPress={onToggle}
          />
        )}
      </View>
    ),
  };
});
it('removes previous presenter annotations until the new share dimensions arrive', async () => {
  mockWidth.mockResolvedValue(1280);
  const props = {
    sessionId: 'meeting',
    height: 400,
    annotating: true,
    composited: false,
  };
  const screen = render(<NativeShareStage {...props} userId="1" />);
  // Native layout normally supplies viewport dimensions.
  const view = screen.UNSAFE_getAllByType(require('react-native').View)[0];
  await act(async () =>
    view.props.onLayout({ nativeEvent: { layout: { width: 600, height: 400 } } }),
  );
  await waitFor(() => expect(screen.getByTestId('annotations')).toHaveTextContent('1'));
  let resolveWidth!: (value: number) => void;
  mockWidth.mockImplementation(
    () =>
      new Promise<number>((resolve) => {
        resolveWidth = resolve;
      }),
  );
  screen.rerender(<NativeShareStage {...props} userId="2" />);
  await waitFor(() => expect(screen.queryByTestId('annotations')).toBeNull());
  await act(async () => {
    resolveWidth(1920);
  });
  await waitFor(() => expect(screen.getByTestId('annotations')).toHaveTextContent('2'));
  screen.unmount();
});

it('exposes the same pencil toggle in embedded and full-screen share stages', async () => {
  mockWidth.mockResolvedValue(1280);
  const onToggleAnnotation = jest.fn();
  const props = {
    sessionId: 'meeting',
    userId: '2',
    height: 400,
    composited: false,
    onToggleAnnotation,
  };
  const screen = render(<NativeShareStage {...props} annotating={false} />);
  await act(async () =>
    screen
      .UNSAFE_getAllByType(require('react-native').View)[0]
      .props.onLayout({ nativeEvent: { layout: { width: 600, height: 400 } } }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Open annotation toolbar')).toBeTruthy(),
  );
  fireEvent.press(screen.getByLabelText('Open annotation toolbar'));
  expect(onToggleAnnotation).toHaveBeenCalledTimes(1);
  screen.rerender(<NativeShareStage {...props} annotating />);
  fireEvent.press(screen.getByLabelText('Close annotation toolbar'));
  expect(onToggleAnnotation).toHaveBeenCalledTimes(2);
});
