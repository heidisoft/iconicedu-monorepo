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
    dedupe: ['react', 'react-dom'],
    alias: {
      '@iconicedu/ui-web': resolve(__dirname, 'src'),
      '@iconicedu/ui-web/': resolve(__dirname, 'src/'),
      '@iconicedu/shared-types': resolve(__dirname, '../shared-types/src'),
      '@iconicedu/shared-types/': resolve(__dirname, '../shared-types/src/'),
      '@iconicedu/utils': resolve(__dirname, '../utils/src'),
      '@iconicedu/utils/': resolve(__dirname, '../utils/src/'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
  },
});
