/** @type {import('jest').Config} */
const jestExpoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...jestExpoPreset,
  resolver: require.resolve('./jest.resolver.js'),
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  setupFiles: [
    // 1. React Native's jest setup (mocks NativeModules, etc.)
    ...(jestExpoPreset.setupFiles || []).filter(
      (f) => !f.includes('jest-expo')
    ),
    // 2. Our patch: ensure NativeModules mock has UIManager
    require.resolve('./jest.setup.js'),
    // 3. jest-expo setup (requires NativeModules.UIManager)
    ...(jestExpoPreset.setupFiles || []).filter((f) =>
      f.includes('jest-expo')
    ),
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(/.*)?|@react-native-community(/.*)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|clsx|tailwind-merge))',
  ],
  moduleNameMapper: {
    ...jestExpoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@iconicedu/ui-native$':
      '<rootDir>/../../packages/ui-native/src/index.ts',
    '^@iconicedu/ui-native/(.*)$':
      '<rootDir>/../../packages/ui-native/src/$1',
    '^@iconicedu/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@iconicedu/shared-types/(.*)$':
      '<rootDir>/../../packages/shared-types/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'html'],
};
