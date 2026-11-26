import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { chooseProfilePhoto } from './profile-photo-picker';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
let sourceIndex = 1;
const assetResult: ImagePicker.ImagePickerResult = {
  canceled: false,
  assets: [{ uri: 'file:///selected-photo.jpg', width: 512, height: 512 }],
};
beforeEach(() => {
  jest.clearAllMocks();
  sourceIndex = 1;
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_options, callback) => callback(sourceIndex));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted',
    expires: 'never',
  } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue(assetResult);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(assetResult);
});
afterEach(() => jest.restoreAllMocks());
it('offers native camera, album and cancel actions directly', async () => {
  await chooseProfilePhoto();
  expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
    expect.objectContaining({
      options: ['Take Photo', 'Choose from Album', 'Cancel'],
      cancelButtonIndex: 2,
    }),
    expect.any(Function),
  );
});
it('chooses from the album without requesting camera access', async () => {
  expect(await chooseProfilePhoto()).toBe('file:///selected-photo.jpg');
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    }),
  );
  expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});
it('requests camera permission before taking a picture', async () => {
  sourceIndex = 0;
  expect(await chooseProfilePhoto()).toBe('file:///selected-photo.jpg');
  expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});
it('does nothing when the source chooser is cancelled', async () => {
  sourceIndex = 2;
  expect(await chooseProfilePhoto()).toBeNull();
  expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});
it('keeps the existing photo when the system picker is cancelled', async () => {
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  expect(await chooseProfilePhoto()).toBeNull();
});
it('handles denied camera permission and opens Settings only when requested', async () => {
  sourceIndex = 0;
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
    granted: false,
    canAskAgain: false,
    status: 'denied',
    expires: 'never',
  } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);
  expect(await chooseProfilePhoto()).toBeNull();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(Linking.openSettings).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  buttons.find((button) => button.text === 'Open Settings')!.onPress!();
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});
it('handles unavailable cameras without crashing', async () => {
  sourceIndex = 0;
  jest
    .mocked(ImagePicker.launchCameraAsync)
    .mockRejectedValue(new Error('Native camera unavailable'));
  expect(await chooseProfilePhoto()).toBeNull();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Camera unavailable',
    expect.stringContaining('album'),
  );
});
it('offers equivalent native choices on Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest
    .mocked(Alert.alert)
    .mockImplementationOnce((_title, _message, buttons) =>
      buttons?.find((button) => button.text === 'Take Photo')?.onPress?.(),
    );
  expect(await chooseProfilePhoto()).toBe('file:///selected-photo.jpg');
  expect(ActionSheetIOS.showActionSheetWithOptions).not.toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
});
