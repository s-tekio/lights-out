import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';
import type { SortColumn, SortOrder } from '../domain/validation.js';

const MAX_POINTS = 999_999;
const POINTS_PAD = 6;
const TIME_PAD = 9;

export const NATURAL_SORT_DIRECTION: Record<SortColumn, SortOrder> = {
  points: 'desc',
  elapsedMs: 'asc',
  playerName: 'asc',
};

const INDEX_BY_SORT: Record<SortColumn, string> = {
  points: 'by-points',
  elapsedMs: 'by-time',
  playerName: 'by-player',
};

export function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Encode the sort key for the `by-points` GSI.
 *
 * The leading component is inverted so that ascending DynamoDB order is
 * descending points. The remaining components keep their natural ascending
 * order: elapsedMs, createdAt, id.
 */
export function encodePointsKey(score: Score): string {
  return `${padNumber(MAX_POINTS - score.points, POINTS_PAD)}#${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
}

/**
 * Encode the sort key for the `by-time` GSI.
 *
 * All components are in natural ascending order: elapsedMs, createdAt, id.
 */
export function encodeTimeKey(score: Score): string {
  return `${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
}

/**
 * Encode the sort key for the `by-player` GSI.
 *
 * All components are in natural ascending order: normalized name, original
 * name, createdAt, id.
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
 * Every GSI sort key is encoded so that ascending key order equals the natural
 * direction for that column. Forward (true) therefore returns natural order,
 * and backward (false) returns the exact mirror. The boolean is not uniform
 * when described by column: for `points` natural order is descending, while
 * for `elapsedMs` and `playerName` it is ascending.
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

export function buildScoreItem(score: Score, scopeKey: string): Record<string, unknown> {
  return {
    id: score.id,
    scopeKey,
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
 * Each score is written twice: once with scopeKey = "all" and once with
 * scopeKey = "board#<boardSize>". Both copies share the same GSI sort keys,
 * so the three GSIs serve both unfiltered and board-size-filtered leaderboard
 * queries.
 *
 * The two copies are one logical record: a score must appear in both the
 * unfiltered and the board-size-filtered leaderboards, or in neither.
 * `save` therefore writes them in a single transaction.
 *
 * `rankOf` counts rows ranked ahead of the submitted score on the `by-points`
 * index using `scopeKey = "all"`. A concurrent write between the transaction
 * and the count query can shift the reported rank by one; this is inherent to
 * a leaderboard and is not hidden behind a transaction.
 */
export class DynamoDbScoreRepository implements ScoreRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(score: Score): Promise<Score> {
    const globalItem = buildScoreItem(score, 'all');
    const boardItem = buildScoreItem(score, `board#${score.boardSize}`);

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: globalItem } },
          { Put: { TableName: this.tableName, Item: boardItem } },
        ],
      }),
    );

    return score;
  }

  async listTop({ limit, boardSize, sort, order }: ListTopOptions): Promise<readonly Score[]> {
    const indexName = INDEX_BY_SORT[sort];
    const scope = scopeFor(boardSize);

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: 'scopeKey = :scope',
        ExpressionAttributeValues: { ':scope': scope },
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
        IndexName: 'by-points',
        KeyConditionExpression: 'scopeKey = :scope AND pointsKey < :key',
        ExpressionAttributeValues: { ':scope': 'all', ':key': sortKey },
        Select: 'COUNT',
      }),
    );

    return (result.Count ?? 0) + 1;
  }
}
