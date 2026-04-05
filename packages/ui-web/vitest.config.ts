import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    preserveSymlinks: false,
    alias: [
      {
        find: /^react$/,
        replacement: resolve(__dirname, '../../node_modules/react'),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(__dirname, '../../node_modules/react/jsx-runtime.js'),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(__dirname, '../../node_modules/react/jsx-dev-runtime.js'),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(__dirname, '../../node_modules/react-dom'),
      },
      {
        find: /^react-dom\/client$/,
        replacement: resolve(__dirname, '../../node_modules/react-dom/client.js'),
      },
      {
        find: /^@iconicedu\/ui-web$/,
        replacement: resolve(__dirname, 'src/index.ts'),
      },
      {
        find: /^@iconicedu\/ui-web\/(.*)$/,
        replacement: resolve(__dirname, 'src/$1'),
      },
      {
        find: /^@iconicedu\/shared-types$/,
        replacement: resolve(__dirname, '../shared-types/src/index.ts'),
      },
      {
        find: /^@iconicedu\/shared-types\/(.*)$/,
        replacement: resolve(__dirname, '../shared-types/src/$1'),
      },
      {
        find: /^@iconicedu\/utils$/,
        replacement: resolve(__dirname, '../utils/src/index.ts'),
      },
      {
        find: /^@iconicedu\/utils\/(.*)$/,
        replacement: resolve(__dirname, '../utils/src/$1'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    globals: true,
    css: false,
    pool: 'vmThreads',
    // The ui-web suite is jsdom-heavy and can exceed the default worker heap on
    // CI runners. Force a single vmThread worker there and recycle it before
    // it grows large enough to crash with ERR_WORKER_OUT_OF_MEMORY.
    poolOptions: {
      vmThreads: isCI
        ? {
            singleThread: true,
            minThreads: 1,
            maxThreads: 1,
            memoryLimit: '512MB',
          }
        : undefined,
    },
    server: {
      deps: {
        inline: [/.*/],
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', '**/node_modules/**'],
    },
  },
});
