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
  mockNativeModules = jest.requireActual('react-native/jest/mocks/NativeModules').default;
} catch {
  mockNativeModules = {};
}

if (!mockNativeModules || typeof mockNativeModules !== 'object') {
  mockNativeModules = {};
}
if (!mockNativeModules.UIManager || typeof mockNativeModules.UIManager !== 'object') {
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
    AudioModule: {
      AudioPlayer: jest.fn().mockImplementation(() => mockPlayer),
      AudioRecorder: jest.fn().mockImplementation(() => mockRecorder),
    },
    RecordingPresets: {
      HIGH_QUALITY: {},
      LOW_QUALITY: {},
    },
    useAudioRecorderPermissions: jest
      .fn()
      .mockReturnValue([
        { granted: true },
        jest.fn().mockResolvedValue({ granted: true }),
      ]),
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

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { Image, View } = require('react-native');
  const passthroughBuilder = {
    withInitialValues: () => ({
      duration: () => undefined,
    }),
    duration: () => undefined,
  };

  const AnimatedComponent = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children),
  );
  const AnimatedImage = React.forwardRef((props, ref) =>
    React.createElement(Image, { ...props, ref }),
  );
  const LayoutAnimationConfig = ({ children }) => children;

  return {
    __esModule: true,
    default: {
      View: AnimatedComponent,
      Image: AnimatedImage,
      createAnimatedComponent: () => AnimatedComponent,
    },
    View: AnimatedComponent,
    Image: AnimatedImage,
    LayoutAnimationConfig,
    createAnimatedComponent: () => AnimatedComponent,
    FadeIn: passthroughBuilder,
    FadeInDown: passthroughBuilder,
    FadeInUp: passthroughBuilder,
    FadeOut: passthroughBuilder,
    FadeOutUp: passthroughBuilder,
    LinearTransition: {
      duration: () => undefined,
    },
    clamp: (value, lowerBound, upperBound) =>
      Math.min(Math.max(value, lowerBound), upperBound),
    useSharedValue: (initialValue) => ({ value: initialValue }),
    useDerivedValue: (updater) => ({ value: updater() }),
    useAnimatedStyle: (updater) => updater(),
    withTiming: (value) => value,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  const chainableGesture = {
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
    onStart: jest.fn().mockReturnThis(),
    enabled: jest.fn().mockReturnThis(),
  };

  return {
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    GestureDetector: ({ children }) => children,
    Gesture: {
      Pinch: jest.fn(() => ({ ...chainableGesture })),
      Pan: jest.fn(() => ({ ...chainableGesture })),
      Tap: jest.fn(() => ({ ...chainableGesture })),
      Race: jest.fn((...gestures) => gestures[0]),
      Simultaneous: jest.fn((...gestures) => gestures[0]),
      Exclusive: jest.fn((...gestures) => gestures[0]),
    },
  };
});

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    WebView: ({ children, ...props }) => React.createElement(View, props, children),
  };
});
