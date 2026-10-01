import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { createLocalScoreRepository } from './application/create-score-repository.js';
import type { ScoreRepository } from './ports/score-repository.js';
import { route, type ApiRequest, type ApiResponse } from './http/router.js';

const PORT = Number(process.env.PORT ?? '3001');

const repo: ScoreRepository = createLocalScoreRepository();

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

function parseQuery(url: URL): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const body = await readRequestBody(request);

  const apiRequest: ApiRequest = {
    method: request.method ?? 'GET',
    path: url.pathname,
    query: parseQuery(url),
    body,
  };

  const apiResponse: ApiResponse = await route(apiRequest, { repo });

  // Development-only server; the Lambda entry point never runs this file.
  // Logging every request gives an unambiguous account of what the browser sent,
  // independent of devtools state or filters.
  console.log(
    `[api] ${apiRequest.method} ${url.pathname}${url.search} -> ${apiResponse.statusCode}`,
  );

  response.writeHead(apiResponse.statusCode, apiResponse.headers);
  response.end(apiResponse.body);
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error('Local server error:', error);
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
          details: [],
        },
      }),
    );
  });
});

server.listen(PORT, () => {
  console.log(`Local ranking API server listening on http://localhost:${PORT}`);
});
