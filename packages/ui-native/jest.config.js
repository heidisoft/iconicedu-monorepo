/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)/)',
  ],
  moduleNameMapper: {
    '^@iconicedu/ui-native/(.*)$': '<rootDir>/src/$1',
    '^@iconicedu/shared-types$': '<rootDir>/../shared-types/src/index.ts',
    '^@iconicedu/shared-types/(.*)$': '<rootDir>/../shared-types/src/$1',
  },
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
