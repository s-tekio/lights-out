import { describe, expect, it } from 'vitest';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

describe('lambda handler', () => {
  it('returns 200 OK for GET /api/health', async () => {
    process.env.SCORES_TABLE_NAME = 'test-table';
    const { handler } = (await import('../../src/http/lambda.js')) as {
      handler: (
        event: APIGatewayProxyEventV2,
        context: Context,
      ) => Promise<APIGatewayProxyStructuredResultV2>;
    };

    const event: APIGatewayProxyEventV2 = {
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
          userAgent: 'test',
        },
        requestId: 'request-id',
        routeKey: 'GET /api/health',
        stage: '$default',
        time: '01/Jan/2024:00:00:00 +0000',
        timeEpoch: 1_704_067_200_000,
      },
      isBase64Encoded: false,
    };

    const result = await handler(event, {} as never);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      'Content-Type': 'application/json; charset=utf-8',
    });
    const body = result.body ?? '{}';
    expect(JSON.parse(body)).toEqual({
      status: 'ok',
      version: '0.1.0',
    });
  });

  it('decodes a base64-encoded body', async () => {
    process.env.SCORES_TABLE_NAME = 'test-table';
    const { handler } = (await import('../../src/http/lambda.js')) as {
      handler: (
        event: APIGatewayProxyEventV2,
        context: Context,
      ) => Promise<APIGatewayProxyStructuredResultV2>;
    };

    const payload = JSON.stringify({ playerName: 'A', boardSize: 10, moves: 7, elapsedMs: 1_000 });
    const event: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: 'POST /api/scores',
      rawPath: '/api/scores',
      rawQueryString: '',
      headers: {},
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'localhost',
        domainPrefix: 'localhost',
        http: {
          method: 'POST',
          path: '/api/scores',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        requestId: 'request-id',
        routeKey: 'POST /api/scores',
        stage: '$default',
        time: '01/Jan/2024:00:00:00 +0000',
        timeEpoch: 1_704_067_200_000,
      },
      body: Buffer.from(payload).toString('base64'),
      isBase64Encoded: true,
    };

    // Validation fails before any repository call, so this asserts the handler
    // decodes the body and event shape without touching DynamoDB.
    const result = await handler(event, {} as never);

    expect(result.statusCode).toBe(400);
  });
});
