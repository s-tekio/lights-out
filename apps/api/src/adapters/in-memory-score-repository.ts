import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';

/**
 * In-memory implementation of {@link ScoreRepository}.
 *
 * Sorting follows the requested column and direction, then falls back to a
 * deterministic tiebreaker chain:
 *   1. createdAt ascending
 *   2. id ascending
 *
 * For playerName, ordering is case-insensitive: normalized name first, then
 * the original name, then the tiebreaker chain.
 */
/**
 * Compare two strings by UTF-16 code unit.
 *
 * Deliberately not `localeCompare`: locale collation depends on the ambient
 * locale and ICU version, so the same data could order differently between a
 * workstation and a Lambda runtime. The DynamoDB adapter will compare a
 * normalized attribute by code unit, so a locale-aware comparison here would
 * make the two adapters disagree for case-only and punctuation-only names.
 * Code-unit order is defined and reproducible on both sides.
 */
function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

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
      const primary = comparePrimary(a, b, sort);
      if (primary !== 0) {
        return order === 'asc' ? primary : -primary;
      }

      const createdAtComparison = compareStrings(a.createdAt, b.createdAt);
      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return compareStrings(a.id, b.id);
    });

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
      const createdAtComparison = compareStrings(a.createdAt, b.createdAt);
      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }
      return compareStrings(a.id, b.id);
    });

    const index = ordered.findIndex((item) => item.id === score.id);
    return Promise.resolve(index === -1 ? ordered.length + 1 : index + 1);
  }
}

function comparePrimary(a: Score, b: Score, sort: ListTopOptions['sort']): number {
  if (sort === 'points') {
    return a.points - b.points;
  }

  if (sort === 'elapsedMs') {
    return a.elapsedMs - b.elapsedMs;
  }

  const normalizedA = a.playerName.toLowerCase();
  const normalizedB = b.playerName.toLowerCase();
  if (normalizedA !== normalizedB) {
    return compareStrings(normalizedA, normalizedB);
  }

  return compareStrings(a.playerName, b.playerName);
}
