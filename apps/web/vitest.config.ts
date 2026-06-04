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
    alias: {
      react: resolve(__dirname, '../../node_modules/react'),
      'react/jsx-runtime': resolve(__dirname, '../../node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(
        __dirname,
        '../../node_modules/react/jsx-dev-runtime.js',
      ),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
      'react-dom/client': resolve(__dirname, '../../node_modules/react-dom/client.js'),
      '@iconicedu/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@iconicedu/shared-types/': resolve(__dirname, '../../packages/shared-types/src/'),
      '@iconicedu/utils': resolve(__dirname, '../../packages/utils/src'),
      '@iconicedu/utils/': resolve(__dirname, '../../packages/utils/src/'),
      '@iconicedu/ui-web': resolve(__dirname, '../../packages/ui-web/src'),
      '@iconicedu/ui-web/': resolve(__dirname, '../../packages/ui-web/src/'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
    pool: 'vmThreads',
    // vmThreads is required for v8 coverage: the forks pool (vitest 4.x default) disconnects
    // the V8 inspector in each worker, causing ERR_INSPECTOR_NOT_CONNECTED on coverage collection.
    // In CI, run serially with a memory cap to avoid OOM in constrained runners.
    ...(isCI && { fileParallelism: false, vmMemoryLimit: '512MB' }),
    // Server-component tests render async RSC trees and use waitFor; 5 s is too tight.
    testTimeout: 10000,
    server: {
      deps: {
        inline: [/.*/],
      },
    },
    include: [
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'flags.test.ts',
    ],
    exclude: ['e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', '**/node_modules/**'],
    },
  },
});
