import { describe, expect, it } from 'vitest';
import type { Score } from '../../src/domain/score.js';
import type { ListTopOptions, ScoreRepository } from '../../src/ports/score-repository.js';
import { route, type ApiResponse } from '../../src/http/router.js';

class InMemoryRepository implements ScoreRepository {
  private readonly scores: Score[] = [];
  private shouldFail: boolean = false;

  failOnNextCall(): void {
    this.shouldFail = true;
  }

  save(score: Score): Promise<Score> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Injected repository failure.'));
    }
    this.scores.push(score);
    return Promise.resolve(score);
  }

  listTop({ limit, boardSize, sort, order }: ListTopOptions): Promise<readonly Score[]> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Injected repository failure.'));
    }

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
    if (this.shouldFail) {
      throw new Error('Injected repository failure.');
    }
    const all = await this.listTop({
      limit: Number.MAX_SAFE_INTEGER,
      boardSize: null,
      sort: 'points',
      order: 'desc',
    });
    const index = all.findIndex((item) => item.id === score.id);
    return index === -1 ? all.length + 1 : index + 1;
  }
}

function parseJson(response: ApiResponse): unknown {
  return JSON.parse(response.body) as unknown;
}

describe('route', () => {
  it('returns health status on GET /api/health', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/health', query: {}, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(parseJson(response)).toEqual({ status: 'ok', version: '0.1.0' });
  });

  it('creates a score and returns 201 with a rank', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      {
        method: 'POST',
        path: '/api/scores',
        query: {},
        body: JSON.stringify({
          playerName: 'Tekio',
          boardSize: 5,
          moves: 7,
          elapsedMs: 42_310,
        }),
      },
      { repo },
    );

    expect(response.statusCode).toBe(201);
    const body = parseJson(response) as { score: Score; rank: number };
    expect(body.score.playerName).toBe('Tekio');
    expect(body.score.boardSize).toBe(5);
    expect(body.score.moves).toBe(7);
    expect(body.score.elapsedMs).toBe(42_310);
    expect(body.score.points).toBe(2_290);
    expect(body.rank).toBe(1);
  });

  it('returns 400 on an invalid body', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      {
        method: 'POST',
        path: '/api/scores',
        query: {},
        body: JSON.stringify({ playerName: '', boardSize: 10, moves: -1, elapsedMs: -1 }),
      },
      { repo },
    );

    expect(response.statusCode).toBe(400);
    const body = parseJson(response) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 400 on malformed JSON', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      {
        method: 'POST',
        path: '/api/scores',
        query: {},
        body: 'not-json',
      },
      { repo },
    );

    expect(response.statusCode).toBe(400);
    const body = parseJson(response) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual({
      field: 'body',
      message: 'must be valid JSON',
    });
  });

  it('returns 404 for unknown routes', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/unknown', query: {}, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(404);
    const body = parseJson(response) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 204 with CORS headers for OPTIONS requests', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'OPTIONS', path: '/api/scores', query: {}, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });

  it('returns 405 for known path with wrong method', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'DELETE', path: '/api/scores', query: {}, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(405);
    const body = parseJson(response) as { error: { code: string } };
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('returns 500 with an injected failing repository', async () => {
    const repo = new InMemoryRepository();
    repo.failOnNextCall();

    const response = await route(
      {
        method: 'POST',
        path: '/api/scores',
        query: {},
        body: JSON.stringify({
          playerName: 'Tekio',
          boardSize: 5,
          moves: 7,
          elapsedMs: 0,
        }),
      },
      { repo },
    );

    expect(response.statusCode).toBe(500);
    const body = parseJson(response) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred.');
  });

  it('lists scores without filters', async () => {
    const repo = new InMemoryRepository();
    await repo.save({
      id: '1',
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
      points: 2_290,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    const response = await route(
      { method: 'GET', path: '/api/scores', query: {}, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(200);
    const body = parseJson(response) as {
      items: Score[];
      limit: number;
      boardSize: number | null;
      sort: string;
      order: string;
    };
    expect(body.items.length).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.boardSize).toBeNull();
    expect(body.sort).toBe('points');
    expect(body.order).toBe('desc');
  });

  it('lists scores with boardSize filter', async () => {
    const repo = new InMemoryRepository();
    await repo.save({
      id: '1',
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
      points: 2_290,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    await repo.save({
      id: '2',
      playerName: 'Other',
      boardSize: 6,
      moves: 7,
      elapsedMs: 42_310,
      points: 2_290,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    const response = await route(
      { method: 'GET', path: '/api/scores', query: { boardSize: '5' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(200);
    const body = parseJson(response) as {
      items: Score[];
      limit: number;
      boardSize: number | null;
      sort: string;
      order: string;
    };
    expect(body.items.length).toBe(1);
    expect(body.items[0]?.boardSize).toBe(5);
    expect(body.boardSize).toBe(5);
    expect(body.sort).toBe('points');
    expect(body.order).toBe('desc');
  });

  it('echoes explicit sort and order parameters', async () => {
    const repo = new InMemoryRepository();
    await repo.save({
      id: '1',
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42_310,
      points: 2_290,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    const response = await route(
      { method: 'GET', path: '/api/scores', query: { sort: 'playerName', order: 'asc' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(200);
    const body = parseJson(response) as {
      items: Score[];
      sort: string;
      order: string;
    };
    expect(body.sort).toBe('playerName');
    expect(body.order).toBe('asc');
  });

  it('ignores unknown query values', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/scores', query: { foo: 'bar' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(200);
    const body = parseJson(response) as { items: Score[] };
    expect(body.items).toEqual([]);
  });

  it('returns 400 for invalid query parameters', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/scores', query: { limit: '0' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(400);
    const body = parseJson(response) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for an unknown sort value', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/scores', query: { sort: 'bogus' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(400);
    const body = parseJson(response) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual({
      field: 'sort',
      message: "must be one of 'points', 'elapsedMs', 'playerName'",
    });
  });

  it('returns 400 for an unknown order value', async () => {
    const repo = new InMemoryRepository();
    const response = await route(
      { method: 'GET', path: '/api/scores', query: { order: 'sideways' }, body: '' },
      { repo },
    );

    expect(response.statusCode).toBe(400);
    const body = parseJson(response) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual({
      field: 'order',
      message: "must be one of 'asc', 'desc'",
    });
  });
});
