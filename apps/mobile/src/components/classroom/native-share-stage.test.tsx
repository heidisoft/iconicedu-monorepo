import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { NativeShareStage } from './native-share-stage';
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
  const Text = require('react-native').Text;
  return {
    NativeScreenAnnotations: ({ shareKey }: { shareKey: string }) => (
      <Text testID="annotations">{shareKey}</Text>
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
