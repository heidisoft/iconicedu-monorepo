import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      '@iconicedu/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@iconicedu/shared-types/': resolve(__dirname, '../../packages/shared-types/src/'),
      '@iconicedu/utils': resolve(__dirname, '../../packages/utils/src'),
      '@iconicedu/utils/': resolve(__dirname, '../../packages/utils/src/'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
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
  },
});
