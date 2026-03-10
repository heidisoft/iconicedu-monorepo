/**
 * jest-expo setup compatibility patch.
 *
 * jest-expo's setup.js does:
 *   require('react-native/Libraries/BatchedBridge/NativeModules').default
 * and expects UIManager to be an object on that default export.
 *
 * When the RN jest mock isn't applied correctly (common in monorepos),
 * the require returns the real module whose .default is undefined.
 * This setup file runs between RN's setup and jest-expo's setup to
 * ensure the mock is registered with UIManager.
 */
'use strict';

let mockNativeModules;
try {
  mockNativeModules = jest.requireActual(
    'react-native/jest/mocks/NativeModules'
  ).default;
} catch {
  mockNativeModules = {};
}

if (!mockNativeModules || typeof mockNativeModules !== 'object') {
  mockNativeModules = {};
}
if (
  !mockNativeModules.UIManager ||
  typeof mockNativeModules.UIManager !== 'object'
) {
  mockNativeModules.UIManager = {};
}

// Re-register the mock with a proper default export so that
// require('react-native/Libraries/BatchedBridge/NativeModules').default works
jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => ({
  __esModule: true,
  default: mockNativeModules,
}));

// Provide a lightweight mock for expo-av in Jest/node environments where the
// native ExponentAV module is unavailable.
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///mock-audio.m4a'),
      createNewLoadedSoundAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          setOnPlaybackStatusUpdate: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true }),
        },
      }),
    })),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          setOnPlaybackStatusUpdate: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true }),
        },
      }),
    },
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(insets),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
