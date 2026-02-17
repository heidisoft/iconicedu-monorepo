/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@iconicedu/ui-native$': '<rootDir>/../../packages/ui-native/src/index.ts',
    '^@iconicedu/ui-native/(.*)$': '<rootDir>/../../packages/ui-native/src/$1',
    '^@iconicedu/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@iconicedu/shared-types/(.*)$':
      '<rootDir>/../../packages/shared-types/src/$1',
  },
};
