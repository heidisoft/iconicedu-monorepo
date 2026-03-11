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

// Provide a lightweight mock for expo-audio in Jest/node environments where
// native audio modules are unavailable.
jest.mock('expo-audio', () => {
  const mockPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
    playing: false,
    currentTime: 0,
    duration: 0,
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };
  const mockRecorder = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: 'file:///mock-audio.m4a',
    currentTime: 0,
    isRecording: false,
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };
  return {
    requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    createAudioPlayer: jest.fn().mockReturnValue(mockPlayer),
    AudioPlayer: jest.fn().mockImplementation(() => mockPlayer),
    AudioRecorder: jest.fn().mockImplementation(() => mockRecorder),
    RecordingPresets: {
      HIGH_QUALITY: {},
      LOW_QUALITY: {},
    },
    useAudioRecorderPermissions: jest
      .fn()
      .mockReturnValue([{ granted: true }, jest.fn().mockResolvedValue({ granted: true })]),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(insets),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
