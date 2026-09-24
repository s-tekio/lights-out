import { describe, expect, it } from 'vitest';
import {
  ApiError,
  fetchLeaderboard,
  MalformedResponseError,
  NetworkError,
  submitScore,
  UnparseableResponseError,
  type FetchLike,
  type Score,
} from './scores';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function createFetchStub(response: Response): {
  readonly fetch: FetchLike;
  readonly calls: ReadonlyArray<{ readonly url: string; readonly init?: RequestInit }>;
} {
  const calls: Array<{ readonly url: string; readonly init?: RequestInit }> = [];

  const fetch: FetchLike = (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return Promise.resolve(response);
  };

  return { fetch, calls };
}

function createFailingFetchStub(error: Error): FetchLike {
  return () => Promise.reject(error);
}

const validScore: Score = {
  id: '3f1c8f1e-6c0e-4a5e-9f4e-0a2b7c9d1e2f',
  playerName: 'Tekio',
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
  points: 2290,
  createdAt: '2026-09-24T12:00:00.000Z',
};

const validSubmission = {
  playerName: 'Tekio',
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
};

describe('submitScore', () => {
  it('parses a successful response into a Score with rank', async () => {
    const { fetch, calls } = createFetchStub(jsonResponse({ score: validScore, rank: 3 }, 201));
    const result = await submitScore(validSubmission, fetch);

    expect(result.score).toEqual(validScore);
    expect(result.rank).toBe(3);

    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) return;

    expect(firstCall.url).toBe('/api/scores');
    expect(firstCall.init).toMatchObject({ method: 'POST' });
  });

  it('rejects a malformed success body instead of casting it', async () => {
    const { fetch } = createFetchStub(
      jsonResponse({ score: { ...validScore, points: 'lots' }, rank: 3 }, 201),
    );

    const error = await submitScore(validSubmission, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MalformedResponseError);
  });

  it('surfaces a 400 with a well-formed error envelope', async () => {
    const { fetch } = createFetchStub(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Score submission is invalid.',
            details: [{ field: 'moves', message: 'must be an integer between 0 and 1000' }],
          },
        },
        400,
      ),
    );

    const error = await submitScore(validSubmission, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);

    if (error instanceof ApiError) {
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Score submission is invalid.');
      expect(error.details[0]?.field).toBe('moves');
    }
  });

  it('surfaces a non-2xx response with an unparseable body', async () => {
    const { fetch } = createFetchStub(new Response('Internal Server Error', { status: 500 }));

    const error = await submitScore(validSubmission, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnparseableResponseError);
  });

  it('surfaces a rejected fetch as a network error', async () => {
    const fetch = createFailingFetchStub(new TypeError('Failed to fetch'));

    const error = await submitScore(validSubmission, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NetworkError);
  });
});

describe('fetchLeaderboard', () => {
  it('parses a successful response into a list of scores', async () => {
    const { fetch, calls } = createFetchStub(
      jsonResponse({ items: [validScore], limit: 10, boardSize: 5 }),
    );
    const result = await fetchLeaderboard({ limit: 10, boardSize: 5 }, fetch);

    expect(result.items).toEqual([validScore]);
    expect(result.limit).toBe(10);
    expect(result.boardSize).toBe(5);

    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) return;

    expect(firstCall.url).toBe('/api/scores?limit=10&boardSize=5');
  });

  it('omits the boardSize parameter when filtering by all sizes', async () => {
    const { fetch, calls } = createFetchStub(
      jsonResponse({ items: [], limit: 10, boardSize: null }),
    );
    await fetchLeaderboard({}, fetch);

    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) return;

    expect(firstCall.url).toBe('/api/scores');
  });

  it('rejects a malformed leaderboard body', async () => {
    const { fetch } = createFetchStub(
      jsonResponse({ items: [{ invalid: true }], limit: 10, boardSize: null }),
    );

    const error = await fetchLeaderboard({}, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MalformedResponseError);
  });

  it('surfaces a leaderboard network failure', async () => {
    const fetch = createFailingFetchStub(new TypeError('Failed to fetch'));

    const error = await fetchLeaderboard({}, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NetworkError);
  });

  it('surfaces a non-2xx leaderboard response with an unparseable body', async () => {
    const { fetch } = createFetchStub(new Response('Unavailable', { status: 503 }));

    const error = await fetchLeaderboard({}, fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnparseableResponseError);
  });
});
