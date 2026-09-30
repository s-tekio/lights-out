import {
  AppError,
  InternalError,
  MethodNotAllowedError,
  NotFoundError,
  ValidationError,
} from '../domain/errors.js';
import { listTopScores, purgeScores, submitScore } from '../application/ranking-service.js';
import type { ScoreRepository } from '../ports/score-repository.js';

const VERSION = '0.1.0';

export type ApiRequest = {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
};

function parseJsonBody(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body;
  }
  if (body === '') {
    return undefined;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ValidationError('Malformed JSON body.', [
      { field: 'body', message: 'must be valid JSON' },
    ]);
  }
}

export type ApiResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

type RouteHandler = (request: ApiRequest, deps: { repo: ScoreRepository }) => Promise<ApiResponse>;

const jsonHeaders: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(body: unknown): ApiResponse {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

function created(body: unknown): ApiResponse {
  return {
    statusCode: 201,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

function noContent(): ApiResponse {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: '',
  };
}

function errorResponse(error: AppError): ApiResponse {
  return {
    statusCode: error.status,
    headers: jsonHeaders,
    body: JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }),
  };
}

const routes: Record<string, Record<string, RouteHandler>> = {
  '/api/health': {
    GET: () => Promise.resolve(ok({ status: 'ok', version: VERSION })),
  },
  '/api/scores': {
    POST: async (request, { repo }) => {
      const result = await submitScore(repo, request.body);
      return created(result);
    },
    GET: async (request, { repo }) => {
      const result = await listTopScores(repo, request.query);
      return ok(result);
    },
    DELETE: async (request, { repo }) => {
      const result = await purgeScores(repo, request.query);
      return ok(result);
    },
  },
};

function logUnexpectedError(request: ApiRequest, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unexpected error on ${request.method} ${request.path}: ${message}`);
}

export async function route(
  request: ApiRequest,
  deps: { repo: ScoreRepository },
): Promise<ApiResponse> {
  try {
    if (request.method === 'OPTIONS') {
      return noContent();
    }

    const methods = routes[request.path];
    if (methods === undefined) {
      return errorResponse(new NotFoundError('Route not found.'));
    }

    const handler = methods[request.method];
    if (handler === undefined) {
      return errorResponse(new MethodNotAllowedError(`Method ${request.method} is not allowed.`));
    }

    const parsedBody = parseJsonBody(request.body);
    const requestWithParsedBody: ApiRequest = {
      ...request,
      body: parsedBody,
    };

    return await handler(requestWithParsedBody, deps);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logUnexpectedError(request, error);
    return errorResponse(new InternalError('An unexpected error occurred.'));
  }
}
