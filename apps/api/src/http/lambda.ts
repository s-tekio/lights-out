import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { InMemoryScoreRepository } from "../adapters/in-memory-score-repository.js";
import type { ScoreRepository } from "../ports/score-repository.js";
import { route, type ApiRequest } from "./router.js";

const repo: ScoreRepository = new InMemoryScoreRepository();

function decodeBody(event: APIGatewayProxyEventV2): string | undefined {
  if (event.body === undefined) {
    return undefined;
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf-8");
  }
  return event.body;
}

function buildApiRequest(event: APIGatewayProxyEventV2): ApiRequest {
  return {
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    body: decodeBody(event),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const request = buildApiRequest(event);
  const response = await route(request, { repo });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
  };
}
