import type { Score } from '../domain/score.js';
import type { SortColumn, SortOrder } from '../domain/validation.js';

export type ListTopOptions = {
  limit: number;
  boardSize: number | null;
  sort: SortColumn;
  order: SortOrder;
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
  deleteAll(): Promise<number>;
}
