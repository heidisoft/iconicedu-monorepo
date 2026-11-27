import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type PhotoSource = 'camera' | 'album';
function chooseSource(): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Edit photo',
          options: ['Take Photo', 'Choose from Album', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (index) => resolve(index === 0 ? 'camera' : index === 1 ? 'album' : null),
      );
    } else {
      Alert.alert(
        'Edit photo',
        undefined,
        [
          { text: 'Take Photo', onPress: () => resolve('camera') },
          { text: 'Choose from Album', onPress: () => resolve('album') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ],
        { cancelable: true, onDismiss: () => resolve(null) },
      );
    }
  });
}

/** Picks a local draft only. Upload and persistence still require save confirmation. */
export async function chooseProfilePhoto(): Promise<string | null> {
  let source: PhotoSource | null = null;
  try {
    source = await chooseSource();
    if (!source) return null;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access to take a profile photo. You can also choose a photo from your album.',
          [
            { text: 'Cancel', style: 'cancel' },
            ...(!permission.canAskAgain
              ? [
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      void Linking.openSettings().catch(() =>
                        Alert.alert(
                          'Unable to open Settings',
                          'Open your device Settings and allow camera access for ICONIC Academy.',
                        ),
                      );
                    },
                  },
                ]
              : [{ text: 'OK' }]),
          ],
        );
        return null;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  } catch {
    Alert.alert(
      source === 'camera' ? 'Camera unavailable' : 'Unable to choose photo',
      source === 'camera'
        ? 'The camera could not be opened. Try choosing a photo from your album instead.'
        : 'Please try choosing your photo again.',
    );
    return null;
  }
}
