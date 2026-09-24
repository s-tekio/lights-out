import { describe, expect, it } from 'vitest';
import { ValidationError } from '../domain/errors.js';
import type { Score } from '../domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../ports/score-repository.js';
import { listTopScores, submitScore } from './ranking-service.js';

class InMemoryRepository implements ScoreRepository {
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
      if (b.points !== a.points) return b.points - a.points;
      if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
      return a.createdAt.localeCompare(b.createdAt);
    });

    return Promise.resolve(ordered.slice(0, limit));
  }

  async rankOf(score: Score): Promise<number> {
    const all = await this.listTop({
      limit: Number.MAX_SAFE_INTEGER,
      boardSize: null,
    });
    const index = all.findIndex((item) => item.id === score.id);
    return index === -1 ? all.length + 1 : index + 1;
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

    expect(result.score.points).toBe(2_290);
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

    expect(result.score.points).toBe(2_290);
  });

  it('throws ValidationError for an invalid body', async () => {
    const repo = new InMemoryRepository();
    await expect(
      submitScore(repo, { playerName: '', boardSize: 10, moves: -1, elapsedMs: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('listTopScores', () => {
  it('returns scores with default limit and null boardSize', async () => {
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

  it('throws ValidationError for an invalid limit', async () => {
    const repo = new InMemoryRepository();
    await expect(listTopScores(repo, { limit: '0' })).rejects.toBeInstanceOf(ValidationError);
  });
});
