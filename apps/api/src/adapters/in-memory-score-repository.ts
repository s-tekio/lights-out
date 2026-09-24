import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';

/**
 * In-memory implementation of {@link ScoreRepository}.
 * Deterministic ordering follows the contract:
 *   1. points descending
 *   2. elapsedMs ascending
 *   3. createdAt ascending
 */
export class InMemoryScoreRepository implements ScoreRepository {
  private readonly scores: Score[] = [];

  save(score: Score): Promise<Score> {
    this.scores.push(score);
    return Promise.resolve(score);
  }

  listTop({ limit, boardSize }: ListTopOptions): Promise<readonly Score[]> {
    const filtered =
      boardSize === null
        ? this.scores
        : this.scores.filter((score) => score.boardSize === boardSize);

    const ordered = [...filtered].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (a.elapsedMs !== b.elapsedMs) {
        return a.elapsedMs - b.elapsedMs;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    return Promise.resolve(ordered.slice(0, limit));
  }

  async rankOf(score: Score): Promise<number> {
    const all = await this.listTop({ limit: Number.MAX_SAFE_INTEGER, boardSize: null });
    const index = all.findIndex((item) => item.id === score.id);
    return index === -1 ? all.length + 1 : index + 1;
  }
}
