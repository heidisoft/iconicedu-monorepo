import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeBackgroundPicker } from './native-background-picker';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      text: 'black',
      textMuted: 'gray',
      action: 'green',
      actionForeground: 'white',
      border: 'gray',
      actionSubtle: 'white',
    },
  }),
}));
jest.mock('@/lib/classroom/background-catalog', () => ({
  BACKGROUND_PHOTOS: [{ value: 'image:room.jpg', label: 'Background 1', source: 1 }],
}));
it('labels choices and changes the effect without uploading a photo', () => {
  const onSelect = jest.fn(),
    onUpload = jest.fn();
  const screen = render(
    <NativeBackgroundPicker
      value="none"
      preview
      onSelect={onSelect}
      onUpload={onUpload}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'No background effect', selected: true }),
  ).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Blur background'));
  expect(onSelect).toHaveBeenCalledWith('blur');
  fireEvent.press(screen.getByLabelText('Background photo: Background 1'));
  expect(onSelect).toHaveBeenCalledWith('image:room.jpg');
  expect(onUpload).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Choose background image'));
  expect(onUpload).toHaveBeenCalledTimes(1);
});
it('reflects the selected effect and only shows the join hint in preview', () => {
  const screen = render(
    <NativeBackgroundPicker
      value="blur"
      preview={false}
      onSelect={jest.fn()}
      onUpload={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Blur background', selected: true }),
  ).toBeTruthy();
  expect(screen.queryByText(/applied when you join/)).toBeNull();
});
