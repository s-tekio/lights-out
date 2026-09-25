import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';
import type { SortColumn, SortOrder } from '../domain/validation.js';

const MAX_POINTS = 999_999;
const POINTS_PAD = 6;
const TIME_PAD = 9;

/**
 * Natural direction for each sortable column.
 *
 * The DynamoDB adapter encodes every sort key so that ascending key order is
 * the natural direction. The in-memory adapter uses the same convention so the
 * two implementations agree.
 */
const NATURAL_DIRECTION: Record<SortColumn, SortOrder> = {
  points: 'desc',
  elapsedMs: 'asc',
  playerName: 'asc',
};

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Build a string key that orders in the natural direction for the requested
 * column. The format mirrors the DynamoDB GSI sort keys so both adapters
 * produce the same order.
 *
 * `#` is a safe separator: player names are allow-listed to `[A-Za-z0-9 _\-.]`,
 * `createdAt` is ISO 8601, and `id` is a UUID, so none of them can contain it.
 */
function naturalKey(score: Score, sort: SortColumn): string {
  if (sort === 'points') {
    return `${padNumber(MAX_POINTS - score.points, POINTS_PAD)}#${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
  }

  if (sort === 'elapsedMs') {
    return `${padNumber(score.elapsedMs, TIME_PAD)}#${score.createdAt}#${score.id}`;
  }

  return `${score.playerName.toLowerCase()}#${score.playerName}#${score.createdAt}#${score.id}`;
}

/**
 * In-memory implementation of {@link ScoreRepository}.
 *
 * Sorting follows the natural direction for the requested column, then falls
 * back to the deterministic tiebreaker chain. The opposite direction is the
 * exact mirror of the natural one, including the tiebreakers, matching the
 * contract's DynamoDB-aware ordering rule.
 */
export class InMemoryScoreRepository implements ScoreRepository {
  private readonly scores: Score[] = [];

  save(score: Score): Promise<Score> {
    this.scores.push(score);
    return Promise.resolve(score);
  }

  listTop({ limit, boardSize, sort, order }: ListTopOptions): Promise<readonly Score[]> {
    const filtered =
      boardSize === null
        ? this.scores
        : this.scores.filter((score) => score.boardSize === boardSize);

    const ordered = [...filtered].sort((a, b) => {
      const keyA = naturalKey(a, sort);
      const keyB = naturalKey(b, sort);
      if (keyA < keyB) {
        return -1;
      }
      if (keyA > keyB) {
        return 1;
      }
      return 0;
    });

    if (order !== NATURAL_DIRECTION[sort]) {
      ordered.reverse();
    }

    return Promise.resolve(ordered.slice(0, limit));
  }

  rankOf(score: Score): Promise<number> {
    const ordered = [...this.scores].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (a.elapsedMs !== b.elapsedMs) {
        return a.elapsedMs - b.elapsedMs;
      }
      if (a.createdAt < b.createdAt) {
        return -1;
      }
      if (a.createdAt > b.createdAt) {
        return 1;
      }
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }
      return 0;
    });

    const index = ordered.findIndex((item) => item.id === score.id);
    return Promise.resolve(index === -1 ? ordered.length + 1 : index + 1);
  }
}
