import { describe, expect, it } from 'vitest';
import type { Score } from '../../src/domain/score.js';
import { InMemoryScoreRepository } from '../../src/adapters/in-memory-score-repository.js';
import { runScoreRepositoryContract } from './score-repository-contract.js';

runScoreRepositoryContract({
  name: 'InMemoryScoreRepository',
  createRepository: () => new InMemoryScoreRepository(),
  reset: async () => Promise.resolve(),
});

function makeScore(overrides: Partial<Score> & Pick<Score, 'id' | 'playerName'>): Score {
  return {
    boardSize: overrides.boardSize ?? 5,
    moves: overrides.moves ?? 7,
    elapsedMs: overrides.elapsedMs ?? 1_000,
    points: overrides.points ?? 2_000,
    createdAt: overrides.createdAt ?? '2026-09-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryScoreRepository is isolated per instance', () => {
  it('does not share scores between instances', async () => {
    const first = new InMemoryScoreRepository();
    const second = new InMemoryScoreRepository();

    await first.save({
      id: '00000000-0000-0000-0000-000000000001',
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    const top = await second.listTop({
      limit: 10,
      boardSize: null,
      sort: 'points',
      order: 'desc',
    });
    expect(top).toEqual([]);
  });
});

describe('InMemoryScoreRepository rankOf tiebreakers', () => {
  it('ranks higher points before lower points', async () => {
    const repo = new InMemoryScoreRepository();
    const high = makeScore({ id: 'a', playerName: 'A', points: 3_000 });
    const low = makeScore({ id: 'b', playerName: 'B', points: 2_000 });

    await repo.save(high);
    await repo.save(low);

    expect(await repo.rankOf(high)).toBe(1);
    expect(await repo.rankOf(low)).toBe(2);
  });

  it('breaks points ties by elapsedMs', async () => {
    const repo = new InMemoryScoreRepository();
    const faster = makeScore({ id: 'a', playerName: 'A', points: 2_000, elapsedMs: 1_000 });
    const slower = makeScore({ id: 'b', playerName: 'B', points: 2_000, elapsedMs: 2_000 });

    await repo.save(slower);
    await repo.save(faster);

    expect(await repo.rankOf(faster)).toBe(1);
    expect(await repo.rankOf(slower)).toBe(2);
  });

  it('breaks points and elapsedMs ties by createdAt', async () => {
    const repo = new InMemoryScoreRepository();
    const earlier = makeScore({
      id: 'a',
      playerName: 'A',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const later = makeScore({
      id: 'b',
      playerName: 'B',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(later);
    await repo.save(earlier);

    expect(await repo.rankOf(earlier)).toBe(1);
    expect(await repo.rankOf(later)).toBe(2);
  });

  it('breaks full ties by id', async () => {
    const repo = new InMemoryScoreRepository();
    const first = makeScore({
      id: '00000000-0000-0000-0000-000000000001',
      playerName: 'A',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const second = makeScore({
      id: '00000000-0000-0000-0000-000000000002',
      playerName: 'B',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const third = makeScore({
      id: '00000000-0000-0000-0000-000000000003',
      playerName: 'C',
      points: 2_000,
      elapsedMs: 1_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    await repo.save(second);
    await repo.save(first);
    await repo.save(third);

    expect(await repo.rankOf(first)).toBe(1);
    expect(await repo.rankOf(second)).toBe(2);
    expect(await repo.rankOf(third)).toBe(3);
  });

  it('returns a rank beyond the list when the score is not present', async () => {
    const repo = new InMemoryScoreRepository();
    const existing = makeScore({ id: 'a', playerName: 'A' });
    const missing = makeScore({ id: 'b', playerName: 'B' });

    await repo.save(existing);

    expect(await repo.rankOf(missing)).toBe(2);
  });
});
