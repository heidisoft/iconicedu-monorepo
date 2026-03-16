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
