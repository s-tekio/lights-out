import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/domain/errors.js';
import type { Score } from '../../src/domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../../src/ports/score-repository.js';
import { listTopScores, purgeScores, submitScore } from '../../src/application/ranking-service.js';

class InMemoryRepository implements ScoreRepository {
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
      let primary = 0;
      if (sort === 'points') {
        primary = a.points - b.points;
      } else if (sort === 'elapsedMs') {
        primary = a.elapsedMs - b.elapsedMs;
      } else {
        const normalizedA = a.playerName.toLowerCase();
        const normalizedB = b.playerName.toLowerCase();
        primary =
          normalizedA === normalizedB
            ? a.playerName.localeCompare(b.playerName)
            : normalizedA.localeCompare(normalizedB);
      }

      if (primary !== 0) {
        return order === 'asc' ? primary : -primary;
      }

      const createdAtComparison = a.createdAt.localeCompare(b.createdAt);
      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return a.id.localeCompare(b.id);
    });

    return Promise.resolve(ordered.slice(0, limit));
  }

  async rankOf(score: Score): Promise<number> {
    const all = await this.listTop({
      limit: Number.MAX_SAFE_INTEGER,
      boardSize: null,
      sort: 'points',
      order: 'desc',
    });
    const index = all.findIndex((item) => item.id === score.id);
    return index === -1 ? all.length + 1 : index + 1;
  }

  deleteAll(): Promise<number> {
    const count = this.scores.length;
    this.scores.length = 0;
    return Promise.resolve(count);
  }
}

describe('submitScore', () => {
  it('computes points server-side, saves, and returns rank 1 for the first score', async () => {
    const repo = new InMemoryRepository();
    const result = await submitScore(repo, {
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
    });

    // A 5x5 at 7 presses and 42.31 s sits inside par (10) and inside the 50 s
    // reference, so both factors are 1 and the score is the full base of 2500.
    expect(result.score.points).toBe(2_500);
    expect(result.rank).toBe(1);
    expect(result.score.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.score.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('ignores a client-supplied points value', async () => {
    const repo = new InMemoryRepository();
    const result = await submitScore(repo, {
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
      points: 99_999,
    });

    expect(result.score.points).toBe(2_500);
  });

  it('throws ValidationError for an invalid body', async () => {
    const repo = new InMemoryRepository();
    await expect(
      submitScore(repo, { playerName: '', boardSize: 10, moves: -1, elapsedMs: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('listTopScores', () => {
  it('returns scores with default limit, null boardSize, and echoed sort defaults', async () => {
    const repo = new InMemoryRepository();
    await submitScore(repo, {
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
    });

    const result = await listTopScores(repo, {});
    expect(result.items.length).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.boardSize).toBeNull();
    expect(result.sort).toBe('points');
    expect(result.order).toBe('desc');
  });

  it('applies the boardSize filter', async () => {
    const repo = new InMemoryRepository();
    await submitScore(repo, {
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    await submitScore(repo, {
      playerName: 'B',
      boardSize: 6,
      moves: 7,
      elapsedMs: 0,
    });

    const result = await listTopScores(repo, { boardSize: '5' });
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.boardSize).toBe(5);
    expect(result.boardSize).toBe(5);
  });

  it('echoes explicit sort and order in the response', async () => {
    const repo = new InMemoryRepository();
    await submitScore(repo, {
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });

    const result = await listTopScores(repo, { sort: 'playerName', order: 'asc' });
    expect(result.sort).toBe('playerName');
    expect(result.order).toBe('asc');
  });

  it('throws ValidationError for an invalid limit', async () => {
    const repo = new InMemoryRepository();
    await expect(listTopScores(repo, { limit: '0' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for an invalid sort', async () => {
    const repo = new InMemoryRepository();
    await expect(listTopScores(repo, { sort: 'bogus' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for an invalid order', async () => {
    const repo = new InMemoryRepository();
    await expect(listTopScores(repo, { order: 'sideways' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('purgeScores', () => {
  it('purges all scores and returns the count when confirmed', async () => {
    const repo = new InMemoryRepository();
    await submitScore(repo, {
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });
    await submitScore(repo, {
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });

    const result = await purgeScores(repo, { confirm: 'DELETE' });
    expect(result.deleted).toBe(2);

    const list = await listTopScores(repo, {});
    expect(list.items).toEqual([]);
  });

  it('throws ValidationError for an invalid confirmation', async () => {
    const repo = new InMemoryRepository();
    await expect(purgeScores(repo, { confirm: 'delete' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('does not purge when the confirmation is invalid', async () => {
    const repo = new InMemoryRepository();
    await submitScore(repo, {
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 0,
    });

    await expect(purgeScores(repo, { confirm: 'no' })).rejects.toBeInstanceOf(ValidationError);

    const list = await listTopScores(repo, {});
    expect(list.items.length).toBe(1);
  });
});
