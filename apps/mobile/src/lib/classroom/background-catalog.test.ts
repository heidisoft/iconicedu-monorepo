import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKGROUND_PHOTOS,
  isBackgroundPreset,
  readBackgroundPreference,
  writeBackgroundPreference,
} from './background-catalog';
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));

describe('native meeting background catalog', () => {
  beforeEach(() => AsyncStorage.clear());
  it('offers the same photo choices and names as web', () => {
    expect(BACKGROUND_PHOTOS.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: 'image:pexels-anna-nekrashevich-8534465.jpg', label: 'Background 1' },
      { value: 'image:pexels-marina-zasorina-7634439.jpg', label: 'Background 2' },
    ]);
  });
  it('remembers a valid choice and ignores removed or tampered values', async () => {
    await writeBackgroundPreference('blur');
    await expect(readBackgroundPreference()).resolves.toBe('blur');
    await AsyncStorage.setItem('classroom.background-preset.v1', 'image:removed.jpg');
    await expect(readBackgroundPreference()).resolves.toBe('none');
    expect(isBackgroundPreset('image:../../secret')).toBe(false);
  });
});
