import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');
const artifactPath = process.env.LAMBDA_ARTIFACT
  ? resolve(packageRoot, process.env.LAMBDA_ARTIFACT)
  : resolve(packageRoot, 'dist', 'lambda.js');

if (!existsSync(artifactPath)) {
  console.error(`FAIL: Lambda artifact not found: ${artifactPath}`);
  process.exit(1);
}

// Copy the artifact to an isolated temporary directory with no package.json so
// Node treats the extension the same way Lambda does.
const tmpDir = mkdtempSync(resolve(tmpdir(), 'verify-lambda-'));
const tmpArtifact = resolve(tmpDir, 'lambda' + extname(artifactPath));
copyFileSync(artifactPath, tmpArtifact);

const isEsmArtifact = tmpArtifact.endsWith('.mjs');
const nodeInputType = isEsmArtifact ? 'module' : 'commonjs';

function cleanup(): void {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

const assertAndInvoke = `
  if (typeof m.handler !== 'function') {
    console.error('FAIL: Artifact does not export a handler function');
    console.error('Exported keys:', Object.keys(m));
    process.exit(1);
  }
  const event = {
    version: '2.0',
    routeKey: 'GET /api/health',
    rawPath: '/api/health',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'GET',
        path: '/api/health',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'verify-lambda',
      },
      requestId: 'request-id',
      routeKey: 'GET /api/health',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1_704_067_200_000,
    },
    isBase64Encoded: false,
  };
  m.handler(event, {})
    .then((result) => {
      if (result.statusCode !== 200) {
        console.error('FAIL: Expected status 200, got', result.statusCode);
        console.error('Body:', result.body);
        process.exit(1);
      }
      const body = JSON.parse(result.body);
      if (body.status !== 'ok' || body.version !== '0.1.0') {
        console.error('FAIL: Unexpected health response body:', JSON.stringify(body));
        process.exit(1);
      }
      console.log('PASS: artifact loaded and handler returned 200 for GET /api/health');
      console.log('Response:', JSON.stringify(body));
    })
    .catch((error) => {
      console.error('FAIL: Lambda handler threw during invocation');
      console.error(error);
      process.exit(1);
    });
`;

const loadAndInvoke = isEsmArtifact
  ? `(async () => { const m = await import(${JSON.stringify(tmpArtifact)}); ${assertAndInvoke} })();`
  : `const m = require(${JSON.stringify(tmpArtifact)}); ${assertAndInvoke}`;

const result = spawnSync(process.execPath, ['--input-type=' + nodeInputType, '-e', loadAndInvoke], {
  env: {
    ...process.env,
    // Ensure the table name is set so the application's own validation does
    // not mask a bundle-level failure.
    SCORES_TABLE_NAME: process.env.SCORES_TABLE_NAME || 'local-health-check',
  },
  stdio: 'inherit',
});

cleanup();
process.exit(result.status ?? (result.error ? 1 : 0));
