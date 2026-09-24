import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api requests to the API dev server without rewriting the path.
      // This keeps the browser URL identical to the production CloudFront path.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx'],
      thresholds: {
        statements: 92,
        branches: 90,
        functions: 90,
        lines: 92,
      },
    },
  },
});
