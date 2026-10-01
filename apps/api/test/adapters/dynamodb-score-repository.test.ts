import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { DynamoDbScoreRepository } from '../../src/adapters/dynamodb-score-repository.js';
import { runScoreRepositoryContract } from './score-repository-contract.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const REQUIRE_DDB_LOCAL = process.env.REQUIRE_DDB_LOCAL === '1';

const lowLevelClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'eu-west-1',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(lowLevelClient);

async function isEndpointReachable(): Promise<boolean> {
  try {
    await lowLevelClient.send(new ListTablesCommand({}));
    return true;
  } catch {
    return false;
  }
}

// Mirrors terraform/dynamodb.tf. A mismatch between the two surfaces as a
// failing test.
async function createScoresTable(tableName: string): Promise<void> {
  try {
    await lowLevelClient.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'allScope', AttributeType: 'S' },
          { AttributeName: 'boardScope', AttributeType: 'S' },
          { AttributeName: 'pointsKey', AttributeType: 'S' },
          { AttributeName: 'timeKey', AttributeType: 'S' },
          { AttributeName: 'playerKey', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'by-points-all',
            KeySchema: [
              { AttributeName: 'allScope', KeyType: 'HASH' },
              { AttributeName: 'pointsKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'by-time-all',
            KeySchema: [
              { AttributeName: 'allScope', KeyType: 'HASH' },
              { AttributeName: 'timeKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'by-player-all',
            KeySchema: [
              { AttributeName: 'allScope', KeyType: 'HASH' },
              { AttributeName: 'playerKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'by-points-board',
            KeySchema: [
              { AttributeName: 'boardScope', KeyType: 'HASH' },
              { AttributeName: 'pointsKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'by-time-board',
            KeySchema: [
              { AttributeName: 'boardScope', KeyType: 'HASH' },
              { AttributeName: 'timeKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'by-player-board',
            KeySchema: [
              { AttributeName: 'boardScope', KeyType: 'HASH' },
              { AttributeName: 'playerKey', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof ResourceInUseException) {
      return;
    }
    throw error;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const description = await lowLevelClient.send(
      new DescribeTableCommand({ TableName: tableName }),
    );
    const status = description.Table?.TableStatus;
    const indexes = description.Table?.GlobalSecondaryIndexes ?? [];
    const allActive = indexes.every((index) => index.IndexStatus === 'ACTIVE');

    if (status === 'ACTIVE' && allActive) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }

  throw new Error(`DynamoDB Local table ${tableName} did not become active in time`);
}

async function deleteScoresTable(tableName: string): Promise<void> {
  try {
    await lowLevelClient.send(new DeleteTableCommand({ TableName: tableName }));
  } catch {
    // Teardown should not fail if the table is already gone.
  }
}

async function clearScoresTable(tableName: string): Promise<void> {
  const keys: Array<{ id: unknown }> = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: 'id',
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    const items = page.Items ?? [];
    for (const item of items) {
      keys.push({ id: item.id });
    }
    lastEvaluatedKey = page.LastEvaluatedKey;
  } while (lastEvaluatedKey !== undefined);

  for (let index = 0; index < keys.length; index += 25) {
    const batch = keys.slice(index, index + 25);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((key) => ({ DeleteRequest: { Key: key } })),
        },
      }),
    );
  }
}

const reachable = await isEndpointReachable();
let tableName: string | undefined;

if (!reachable) {
  if (REQUIRE_DDB_LOCAL) {
    throw new Error(
      `DynamoDB Local is required (REQUIRE_DDB_LOCAL=1) but unreachable at ${ENDPOINT}`,
    );
  }

  console.warn(
    `\n⚠️  DynamoDB Local is unreachable at ${ENDPOINT}. ` +
      `Skipping DynamoDB integration tests. ` +
      `Set REQUIRE_DDB_LOCAL=1 to fail instead of skip.\n`,
  );

  describe.skip('DynamoDbScoreRepository integration', () => {
    it('skipped because DynamoDB Local is not running', () => {
      // This test is skipped; the warning above explains why.
    });
  });
} else {
  tableName = `test-scores-${Date.now()}`;
  await createScoresTable(tableName);

  describe('DynamoDbScoreRepository integration', () => {
    beforeAll(async () => {
      // Table created at module load so the contract suite can run.
    });

    afterAll(async () => {
      if (tableName !== undefined) {
        await deleteScoresTable(tableName);
      }
    });

    runScoreRepositoryContract({
      name: 'DynamoDbScoreRepository',
      createRepository: () => new DynamoDbScoreRepository(docClient, tableName as string),
      reset: async () => {
        if (tableName !== undefined) {
          await clearScoresTable(tableName);
        }
      },
    });
  });
}
