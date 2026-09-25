import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [resolve(packageRoot, 'src/http/lambda.ts')],
  bundle: true,
  outfile: resolve(packageRoot, 'dist/lambda.js'),
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
});

// Remove the stale ESM artifact so it cannot be shipped by accident.
const staleFiles = [
  resolve(packageRoot, 'dist/lambda.mjs'),
  resolve(packageRoot, 'dist/lambda.mjs.map'),
];

await Promise.all(
  staleFiles.map(async (file) => {
    try {
      await rm(file);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }),
);

console.log('Bundled Lambda handler to dist/lambda.js');
