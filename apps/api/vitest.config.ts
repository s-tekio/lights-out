import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/local-server.ts'],
      thresholds: {
        statements: 85,
        branches: 90,
        functions: 95,
        lines: 85,
      },
    },
  },
});
