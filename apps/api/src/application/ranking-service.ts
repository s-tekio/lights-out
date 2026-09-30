import { randomUUID } from 'node:crypto';
import { ValidationError } from '../domain/errors.js';
import { computePoints } from '../domain/score.js';
import type { Score, ScoreInput } from '../domain/score.js';
import {
  parsePurgeConfirmation,
  parseScoreQuery,
  parseScoreSubmission,
  type ScoreQuery,
} from '../domain/validation.js';
import type { ScoreRepository } from '../ports/score-repository.js';

export type SubmitScoreResult = {
  score: Score;
  rank: number;
};

export async function submitScore(
  repo: ScoreRepository,
  rawBody: unknown,
): Promise<SubmitScoreResult> {
  const parsed = parseScoreSubmission(rawBody);
  if (!parsed.ok) {
    throw new ValidationError('Score submission is invalid.', parsed.errors);
  }

  const input: ScoreInput = parsed.value;
  const now = new Date();
  const score: Score = {
    id: randomUUID(),
    playerName: input.playerName,
    boardSize: input.boardSize,
    moves: input.moves,
    elapsedMs: input.elapsedMs,
    points: computePoints(input),
    createdAt: now.toISOString(),
  };

  await repo.save(score);
  const rank = await repo.rankOf(score);
  return { score, rank };
}

export type ListTopScoresResult = {
  items: readonly Score[];
  limit: number;
  boardSize: number | null;
  sort: ScoreQuery['sort'];
  order: ScoreQuery['order'];
};

export async function listTopScores(
  repo: ScoreRepository,
  rawQuery: unknown,
): Promise<ListTopScoresResult> {
  const parsed = parseScoreQuery(rawQuery);
  if (!parsed.ok) {
    throw new ValidationError('Query parameters are invalid.', parsed.errors);
  }

  const query: ScoreQuery = parsed.value;
  const items = await repo.listTop(query);
  return {
    items,
    limit: query.limit,
    boardSize: query.boardSize,
    sort: query.sort,
    order: query.order,
  };
}

export type PurgeScoresResult = {
  deleted: number;
};

export async function purgeScores(
  repo: ScoreRepository,
  rawQuery: unknown,
): Promise<PurgeScoresResult> {
  const parsed = parsePurgeConfirmation(rawQuery);
  if (!parsed.ok) {
    throw new ValidationError('Purge confirmation is invalid.', parsed.errors);
  }

  const deleted = await repo.deleteAll();
  return { deleted };
}
