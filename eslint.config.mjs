import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const base = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.next/**',
    'apps/web/next-env.d.ts',
    'apps/web/lighthouserc.js',
    'apps/web/playwright.config.js',
    'apps/web/app/.well-known/vercel/flags/**',
  ],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    globals: {
      ...globals['shared-node-browser'],
      ...globals.browser,
      ...globals.node,
      React: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': tseslint,
    react,
    'react-hooks': reactHooks,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tseslint.configs.recommended.rules,
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off',
  },
};

const withProject = (pattern, tsconfigPath) => ({
  ...base,
  files: Array.isArray(pattern) ? pattern : [pattern],
  languageOptions: {
    ...base.languageOptions,
    parserOptions: {
      ...base.languageOptions.parserOptions,
      project: tsconfigPath,
      tsconfigRootDir: path.dirname(tsconfigPath),
    },
  },
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/web/next-env.d.ts',
      'apps/web/lighthouserc.js',
      'apps/web/playwright.config.js',
      'apps/web/app/.well-known/vercel/flags/**',
    ],
  },
  {
    ...base,
    files: ['**/*.{ts,tsx,js,jsx}'],
  },
  withProject(
    ['apps/web/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'apps/web/tsconfig.json'),
  ),
  withProject(
    ['apps/mobile/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'apps/mobile/tsconfig.eslint.json'),
  ),
  withProject(
    ['apps/api/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'apps/api/tsconfig.json'),
  ),
  withProject(
    ['packages/ui-web/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'packages/ui-web/tsconfig.json'),
  ),
  withProject(
    ['packages/ui-native/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'packages/ui-native/tsconfig.eslint.json'),
  ),
  withProject(
    ['packages/utils/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'packages/utils/tsconfig.json'),
  ),
  withProject(
    ['packages/shared-types/**/*.{ts,tsx,js,jsx}'],
    path.join(__dirname, 'packages/shared-types/tsconfig.json'),
  ),
  {
    files: ['apps/web/tailwind.config.ts', 'packages/ui-web/tailwind.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/vitest.config.ts', '**/vite.config.ts', '**/lighthouserc.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
  },
  {
    files: [
      'apps/mobile/**/*.{ts,tsx,js,jsx}',
      'packages/ui-native/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      globals: {
        __DEV__: 'readonly',
      },
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      'apps/mobile/src/**/*.{ts,tsx,js,jsx}',
      'apps/mobile/app/**/*.{ts,tsx,js,jsx}',
      'apps/web/app/**/*.{ts,tsx,js,jsx}',
      'apps/web/components/**/*.{ts,tsx,js,jsx}',
      'apps/web/lib/**/*.{ts,tsx,js,jsx}',
      'apps/api/src/**/*.{ts,tsx,js,jsx}',
      'packages/shared-types/src/**/*.{ts,tsx,js,jsx}',
      'packages/ui-web/src/**/*.{ts,tsx,js,jsx}',
      'packages/ui-native/src/**/*.{ts,tsx,js,jsx}',
      'packages/utils/src/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      'no-console': 'error',
    },
  },
];
