import type { Score } from '../domain/score.js';

export type ListTopOptions = {
  limit: number;
  boardSize: number | null;
};

/**
 * Persistence port for scores.
 * A concrete adapter (in-memory today, DynamoDB tomorrow) implements this
 * interface so the application layer stays decoupled from storage technology.
 */
export interface ScoreRepository {
  save(score: Score): Promise<Score>;
  listTop(options: ListTopOptions): Promise<readonly Score[]>;
  rankOf(score: Score): Promise<number>;
}
