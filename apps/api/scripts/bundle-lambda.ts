import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [resolve(packageRoot, 'src/http/lambda.ts')],
  bundle: true,
  outfile: resolve(packageRoot, 'dist/lambda.mjs'),
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
});

console.log('Bundled Lambda handler to dist/lambda.mjs');
