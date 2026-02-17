/**
 * jest-expo setup compatibility patch.
 *
 * jest-expo's setup.js calls Object.defineProperty on NativeModules.UIManager
 * which may be undefined if the RN mock wasn't applied correctly.
 * This setup file runs between RN's setup and jest-expo's setup to
 * ensure UIManager is a valid object.
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

// Re-register the mock so jest-expo's setup gets it with UIManager defined
jest.mock(
  'react-native/Libraries/BatchedBridge/NativeModules',
  () => mockNativeModules
);
