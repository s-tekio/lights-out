import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDbScoreRepository } from '../adapters/dynamodb-score-repository.js';
import { InMemoryScoreRepository } from '../adapters/in-memory-score-repository.js';
import type { ScoreRepository } from '../ports/score-repository.js';

export type RepositorySource = 'lambda' | 'local';

export type ScoreRepositoryConfig = {
  source: RepositorySource;
  tableName?: string | undefined;
  endpoint?: string | undefined;
};

function createDocumentClient(endpoint: string | undefined): DynamoDBDocumentClient {
  const config: DynamoDBClientConfig = {
    region: process.env.AWS_REGION ?? 'eu-west-1',
  };

  if (endpoint !== undefined && endpoint !== '') {
    config.endpoint = endpoint;
  }

  const client = new DynamoDBClient(config);
  return DynamoDBDocumentClient.from(client);
}

/**
 * Create a {@link ScoreRepository} from an explicit configuration object.
 *
 * - In local development, omitting `tableName` selects the in-memory adapter.
 *   Setting `tableName` selects DynamoDB, optionally pointed at a local
 *   endpoint via `endpoint`.
 * - In the Lambda entry point, `tableName` is required and the process fails
 *   loudly at cold start if it is missing. There is no silent fallback to the
 *   in-memory store: a misconfigured deployment that stops persisting would be
 *   worse than a failure.
 */
export function createScoreRepository(config: ScoreRepositoryConfig): ScoreRepository {
  if (config.source === 'local' && (config.tableName === undefined || config.tableName === '')) {
    return new InMemoryScoreRepository();
  }

  const tableName = config.tableName;
  if (tableName === undefined || tableName === '') {
    throw new Error(
      `Missing required configuration: tableName is required for source=${config.source}`,
    );
  }

  const docClient = createDocumentClient(config.endpoint);
  return new DynamoDbScoreRepository(docClient, tableName);
}

/**
 * Factory for the Lambda handler. Reads `SCORES_TABLE_NAME` once at module
 * load and throws if it is absent, so the function fails to initialise rather
 * than running against an in-memory store in production.
 */
export function createLambdaScoreRepository(): ScoreRepository {
  const tableName = process.env.SCORES_TABLE_NAME;
  if (tableName === undefined || tableName === '') {
    throw new Error('Missing required environment variable: SCORES_TABLE_NAME');
  }

  return createScoreRepository({ source: 'lambda', tableName });
}

/**
 * Factory for the local development server. Defaults to the in-memory adapter
 * unless `SCORES_TABLE_NAME` is set, in which case it points at DynamoDB using
 * `DYNAMODB_ENDPOINT` when provided.
 */
export function createLocalScoreRepository(): ScoreRepository {
  const tableName = process.env.SCORES_TABLE_NAME;
  const endpoint = process.env.DYNAMODB_ENDPOINT;

  return createScoreRepository({ source: 'local', tableName, endpoint });
}
