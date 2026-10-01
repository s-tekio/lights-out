import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';
import type { SortColumn, SortOrder } from '../domain/validation.js';

const MAX_POINTS = 999_999;
const POINTS_PAD = 6;
const TIME_PAD = 9;

const BATCH_WRITE_SIZE = 25;
const MAX_BATCH_RETRIES = 3;
const BATCH_RETRY_DELAY_MS = 100;

export const NATURAL_SORT_DIRECTION: Record<SortColumn, SortOrder> = {
  points: 'desc',
  elapsedMs: 'asc',
  playerName: 'asc',
};

const INDEX_BY_SORT_AND_SCOPE: Record<SortColumn, Record<'all' | 'board', string>> = {
  points: { all: 'by-points-all', board: 'by-points-board' },
  elapsedMs: { all: 'by-time-all', board: 'by-time-board' },
  playerName: { all: 'by-player-all', board: 'by-player-board' },
};

export function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Encode the sort key for the points GSI.
 *
 * The leading component is inverted so ascending DynamoDB order is descending
 * points. The remaining components keep their natural ascending order.
 */
export function encodePointsKey(score: Score): string {
  return `${padNumber(MAX_POINTS - score.points, POINTS_PAD)}#${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
}

/**
 * Encode the sort key for the time GSI.
 *
 * All components are in natural ascending order.
 */
export function encodeTimeKey(score: Score): string {
  return `${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
}

/**
 * Encode the sort key for the player GSI.
 *
 * All components are in natural ascending order.
 */
export function encodePlayerKey(score: Score): string {
  return `${score.playerName.toLowerCase()}#${score.playerName}#${score.createdAt}#${score.id}`;
}

export function scopeFor(boardSize: number | null): string {
  return boardSize === null ? 'all' : `board#${boardSize}`;
}

/**
 * Map a public sort/order request to DynamoDB's `ScanIndexForward`.
 *
 * Every GSI sort key is encoded so ascending key order equals the natural
 * direction for that column. Forward (true) therefore returns natural order,
 * and backward (false) its exact mirror. The natural direction is not uniform:
 * descending for `points`, ascending for `elapsedMs` and `playerName`.
 */
export function scanIndexForward(sort: SortColumn, order: SortOrder): boolean {
  return order === NATURAL_SORT_DIRECTION[sort];
}

function encodeSortKey(score: Score, sort: SortColumn): string {
  if (sort === 'points') {
    return encodePointsKey(score);
  }
  if (sort === 'elapsedMs') {
    return encodeTimeKey(score);
  }
  return encodePlayerKey(score);
}

export function buildScoreItem(score: Score): Record<string, unknown> {
  return {
    id: score.id,
    allScope: 'all',
    boardScope: `board#${score.boardSize}`,
    playerName: score.playerName,
    playerNameLower: score.playerName.toLowerCase(),
    boardSize: score.boardSize,
    moves: score.moves,
    elapsedMs: score.elapsedMs,
    points: score.points,
    createdAt: score.createdAt,
    pointsKey: encodePointsKey(score),
    timeKey: encodeTimeKey(score),
    playerKey: encodePlayerKey(score),
  };
}

function mapItemToScore(item: Record<string, unknown>): Score {
  return {
    id: item.id as string,
    playerName: item.playerName as string,
    boardSize: item.boardSize as number,
    moves: item.moves as number,
    elapsedMs: item.elapsedMs as number,
    points: item.points as number,
    createdAt: item.createdAt as string,
  };
}

/**
 * DynamoDB implementation of {@link ScoreRepository}.
 *
 * Each score is stored as a single item with two scope attributes
 * (`allScope`, `boardScope`). The six GSIs provide every query path: all
 * scores vs. one board size, times the three sort dimensions. Direction is
 * handled by `ScanIndexForward`, not by extra indexes.
 *
 * `save` uses a single PutItem. The previous design wrote the same score as
 * two items (global and per-board) and needed a transaction to keep them
 * consistent; one item removes that problem by construction.
 *
 * `rankOf` counts rows ranked ahead of the submitted score on the
 * `by-points-all` index. A concurrent write between PutItem and the count
 * query can shift the reported rank by one; this is inherent to a leaderboard
 * and is not hidden behind a transaction.
 */
export class DynamoDbScoreRepository implements ScoreRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(score: Score): Promise<Score> {
    // One item per score: PutItem is then atomic, which denormalising into two items was not.
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: buildScoreItem(score),
      }),
    );

    return score;
  }

  async listTop({ limit, boardSize, sort, order }: ListTopOptions): Promise<readonly Score[]> {
    const scope: 'all' | 'board' = boardSize === null ? 'all' : 'board';
    const indexName = INDEX_BY_SORT_AND_SCOPE[sort][scope];
    const partitionKey = scope === 'all' ? 'allScope' : 'boardScope';
    const scopeValue = scope === 'all' ? 'all' : `board#${boardSize}`;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: `${partitionKey} = :scope`,
        ExpressionAttributeValues: { ':scope': scopeValue },
        ScanIndexForward: scanIndexForward(sort, order),
        Limit: limit,
      }),
    );

    return (result.Items ?? []).map((item) => mapItemToScore(item as Record<string, unknown>));
  }

  async rankOf(score: Score): Promise<number> {
    const sortKey = encodeSortKey(score, 'points');

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'by-points-all',
        KeyConditionExpression: 'allScope = :scope AND pointsKey < :key',
        ExpressionAttributeValues: { ':scope': 'all', ':key': sortKey },
        Select: 'COUNT',
      }),
    );

    return (result.Count ?? 0) + 1;
  }

  async deleteAll(): Promise<number> {
    // A full table Scan is proportional to table size. That is fine at this scale.
    const keys: Array<{ id: string }> = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: 'id',
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      const items = result.Items ?? [];
      for (const item of items) {
        keys.push({ id: item.id as string });
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey !== undefined);

    let deleted = 0;
    for (let index = 0; index < keys.length; index += BATCH_WRITE_SIZE) {
      const batch = keys.slice(index, index + BATCH_WRITE_SIZE);
      deleted += await this.deleteBatch(batch);
    }

    return deleted;
  }

  private async deleteBatch(keys: Array<{ id: string }>): Promise<number> {
    let remaining = keys;

    for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt += 1) {
      const result = await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: remaining.map((key) => ({ DeleteRequest: { Key: key } })),
          },
        }),
      );

      const unprocessed = result.UnprocessedItems?.[this.tableName] ?? [];
      if (unprocessed.length === 0) {
        return keys.length;
      }

      remaining = unprocessed
        .map((request) =>
          'DeleteRequest' in request && request.DeleteRequest?.Key !== undefined
            ? (request.DeleteRequest.Key as { id: string })
            : undefined,
        )
        .filter((key): key is { id: string } => key !== undefined);

      if (remaining.length > 0 && attempt < MAX_BATCH_RETRIES) {
        await new Promise((resolve) => {
          setTimeout(resolve, BATCH_RETRY_DELAY_MS);
        });
      }
    }

    throw new Error(
      `Failed to delete ${remaining.length} score(s) after ${MAX_BATCH_RETRIES} retries.`,
    );
  }
}
