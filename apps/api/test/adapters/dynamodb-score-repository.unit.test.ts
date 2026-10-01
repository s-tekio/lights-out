import { describe, expect, it, vi } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDbScoreRepository } from '../../src/adapters/dynamodb-score-repository.js';

function mockDocClient(sendOverride?: () => Promise<unknown>): {
  client: DynamoDBDocumentClient;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const client = {
    send: vi.fn((command: { input: unknown }) => {
      sent.push(command.input);
      if (sendOverride !== undefined) {
        return sendOverride();
      }
      return Promise.resolve({ Items: [], Count: 0 });
    }),
  } as unknown as DynamoDBDocumentClient;
  return { client, sent };
}

function mockDocClientWithBehavior(
  behavior: (command: ScanCommand | BatchWriteCommand) => Promise<unknown>,
): {
  client: DynamoDBDocumentClient;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const client = {
    send: vi.fn((command: ScanCommand | BatchWriteCommand) => {
      sent.push(command.input);
      return behavior(command);
    }),
  } as unknown as DynamoDBDocumentClient;
  return { client, sent };
}

const score = {
  id: '00000000-0000-0000-0000-000000000001',
  playerName: 'Tekio',
  boardSize: 5,
  moves: 7,
  elapsedMs: 1_000,
  points: 2_500,
  createdAt: '2026-09-24T12:00:00.000Z',
};

describe('DynamoDbScoreRepository unit', () => {
  it('writes a single item with both scope attributes', async () => {
    const { client, sent } = mockDocClient();
    const repo = new DynamoDbScoreRepository(client, 'scores');

    await repo.save(score);

    expect(sent).toHaveLength(1);
    const input = sent[0] as {
      TableName: string;
      Item: { allScope: string; boardScope: string; scopeKey?: string };
    };
    expect(input.TableName).toBe('scores');
    expect(input.Item.allScope).toBe('all');
    expect(input.Item.boardScope).toBe('board#5');
    expect(input.Item.scopeKey).toBeUndefined();
  });

  it('rejects when the put fails', async () => {
    const { client } = mockDocClient(() => Promise.reject(new Error('Put failed')));
    const repo = new DynamoDbScoreRepository(client, 'scores');

    await expect(repo.save(score)).rejects.toThrow('Put failed');
  });

  it('queries the all-scope GSI when no board size is given', async () => {
    const { client, sent } = mockDocClient();
    const repo = new DynamoDbScoreRepository(client, 'scores');

    await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });

    const input = sent[0] as {
      TableName: string;
      IndexName: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
      ScanIndexForward: boolean;
      Limit: number;
    };
    expect(input.TableName).toBe('scores');
    expect(input.IndexName).toBe('by-points-all');
    expect(input.KeyConditionExpression).toBe('allScope = :scope');
    expect(input.ExpressionAttributeValues[':scope']).toBe('all');
    // The points key is inverted: ascending order is descending points.
    expect(input.ScanIndexForward).toBe(true);
    expect(input.Limit).toBe(10);
  });

  it('queries the board-scope GSI when a boardSize filter is given', async () => {
    const { client, sent } = mockDocClient();
    const repo = new DynamoDbScoreRepository(client, 'scores');

    await repo.listTop({ limit: 5, boardSize: 7, sort: 'elapsedMs', order: 'asc' });

    const input = sent[0] as {
      IndexName: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
    };
    expect(input.IndexName).toBe('by-time-board');
    expect(input.KeyConditionExpression).toBe('boardScope = :scope');
    expect(input.ExpressionAttributeValues[':scope']).toBe('board#7');
  });

  it('counts rows ahead on the by-points-all index for rankOf', async () => {
    const { client, sent } = mockDocClient();
    const repo = new DynamoDbScoreRepository(client, 'scores');

    const rank = await repo.rankOf(score);

    const input = sent[0] as {
      TableName: string;
      IndexName: string;
      Select: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
    };
    expect(input.TableName).toBe('scores');
    expect(input.IndexName).toBe('by-points-all');
    expect(input.Select).toBe('COUNT');
    expect(input.KeyConditionExpression).toBe('allScope = :scope AND pointsKey < :key');
    expect(input.ExpressionAttributeValues[':scope']).toBe('all');
    expect(rank).toBe(1);
  });

  it('returns an empty list when DynamoDB omits Items', async () => {
    const { client } = mockDocClient(() => Promise.resolve({ Count: 0 }));
    const repo = new DynamoDbScoreRepository(client, 'scores');

    const top = await repo.listTop({
      limit: 10,
      boardSize: null,
      sort: 'points',
      order: 'desc',
    });

    expect(top).toEqual([]);
  });

  it('defaults Count to 0 for rankOf when DynamoDB omits Count', async () => {
    const { client } = mockDocClient(() => Promise.resolve({ Items: [] }));
    const repo = new DynamoDbScoreRepository(client, 'scores');

    const rank = await repo.rankOf(score);

    expect(rank).toBe(1);
  });

  it('scans and deletes all items, returning the count', async () => {
    const { client } = mockDocClientWithBehavior((command) => {
      if (command instanceof ScanCommand) {
        return Promise.resolve({ Items: [{ id: 'a' }, { id: 'b' }] });
      }
      return Promise.resolve({ UnprocessedItems: {} });
    });
    const repo = new DynamoDbScoreRepository(client, 'scores');

    const deleted = await repo.deleteAll();

    expect(deleted).toBe(2);
  });

  it('retries unprocessed delete items', async () => {
    const { client } = mockDocClientWithBehavior((command) => {
      if (command instanceof ScanCommand) {
        return Promise.resolve({ Items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
      }

      const input = command.input as { RequestItems?: Record<string, unknown[]> };
      const requests = input.RequestItems?.scores ?? [];
      if (requests.length === 3) {
        return Promise.resolve({
          UnprocessedItems: {
            scores: [{ DeleteRequest: { Key: { id: 'b' } } }],
          },
        });
      }

      return Promise.resolve({ UnprocessedItems: {} });
    });
    const repo = new DynamoDbScoreRepository(client, 'scores');

    const deleted = await repo.deleteAll();

    expect(deleted).toBe(3);
  });

  it('rejects when unprocessed items persist after retries', async () => {
    const { client } = mockDocClientWithBehavior((command) => {
      if (command instanceof ScanCommand) {
        return Promise.resolve({ Items: [{ id: 'a' }] });
      }
      return Promise.resolve({
        UnprocessedItems: {
          scores: [{ DeleteRequest: { Key: { id: 'a' } } }],
        },
      });
    });
    const repo = new DynamoDbScoreRepository(client, 'scores');

    await expect(repo.deleteAll()).rejects.toThrow('Failed to delete 1 score(s) after 3 retries.');
  });
});
