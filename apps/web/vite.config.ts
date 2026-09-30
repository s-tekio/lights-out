import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // The proxy target is configurable so the dev frontend can be pointed at any API,
  // including the deployed one:
  //
  //   VITE_API_PROXY_TARGET=https://<api-id>.execute-api.eu-west-1.amazonaws.com npm run dev:web
  //
  // The default is the local API dev server, whose store is in memory. Pointing it
  // at API Gateway is what makes the browser exercise the real Lambda and DynamoDB.
  //
  // The browser still calls /api/... and the proxy forwards server side, so the URL
  // the application uses never changes and no CORS is involved.
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Forward /api requests to the API without rewriting the path. This keeps
        // the browser URL identical to the production CloudFront path.
        '/api': {
          target: apiProxyTarget,
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
  };
});
