import { describe, expect, it } from 'vitest';
import type { Score } from '../../src/domain/score.js';
import { InMemoryScoreRepository } from '../../src/adapters/in-memory-score-repository.js';

function score(partial: Omit<Score, 'id'> & Partial<Pick<Score, 'id'>>): Score {
  return {
    id: partial.id ?? '00000000-0000-0000-0000-000000000000',
    playerName: partial.playerName,
    boardSize: partial.boardSize,
    moves: partial.moves,
    elapsedMs: partial.elapsedMs,
    points: partial.points,
    createdAt: partial.createdAt,
  };
}

describe('InMemoryScoreRepository', () => {
  it('saves and returns the same score', async () => {
    const repo = new InMemoryScoreRepository();
    const item = score({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_400,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    const saved = await repo.save(item);
    expect(saved).toBe(item);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });
    expect(top).toEqual([item]);
  });

  it('orders by points descending', async () => {
    const repo = new InMemoryScoreRepository();
    const first = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 3_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const second = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(first);
    await repo.save(second);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });
    expect(top.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('orders by points ascending as the exact reverse of descending for distinct points', async () => {
    const repo = new InMemoryScoreRepository();
    const high = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 3_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const low = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(high);
    await repo.save(low);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'asc' });
    expect(top.map((item) => item.id)).toEqual(['2', '1']);
  });

  it('breaks ties by createdAt ascending when sorting by points', async () => {
    const repo = new InMemoryScoreRepository();
    const earlier = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 2_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const later = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(earlier);
    await repo.save(later);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });
    expect(top.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('breaks remaining ties by createdAt ascending', async () => {
    const repo = new InMemoryScoreRepository();
    const later = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });
    const earlier = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    await repo.save(later);
    await repo.save(earlier);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });
    expect(top.map((item) => item.id)).toEqual(['2', '1']);
  });

  it('truncates results to the requested limit', async () => {
    const repo = new InMemoryScoreRepository();
    for (let index = 0; index < 5; index += 1) {
      await repo.save(
        score({
          id: String(index),
          playerName: 'Player',
          boardSize: 5,
          moves: 7,
          elapsedMs: 1_000,
          points: 1_000 - index,
          createdAt: '2026-09-24T12:00:00.000Z',
        }),
      );
    }

    const top = await repo.listTop({ limit: 3, boardSize: null, sort: 'points', order: 'desc' });
    expect(top.length).toBe(3);
    expect(top.map((item) => item.id)).toEqual(['0', '1', '2']);
  });

  it('filters by board size', async () => {
    const repo = new InMemoryScoreRepository();
    const sizeFive = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const sizeSix = score({
      id: '2',
      playerName: 'B',
      boardSize: 6,
      moves: 7,
      elapsedMs: 1_000,
      points: 3_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    await repo.save(sizeFive);
    await repo.save(sizeSix);

    const top = await repo.listTop({ limit: 10, boardSize: 5, sort: 'points', order: 'desc' });
    expect(top).toEqual([sizeFive]);
  });

  it('reports the correct rank including a tie broken by elapsedMs', async () => {
    const repo = new InMemoryScoreRepository();
    const slower = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 2_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const faster = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(slower);
    await repo.save(faster);

    expect(await repo.rankOf(faster)).toBe(1);
    expect(await repo.rankOf(slower)).toBe(2);
  });

  it('orders by elapsedMs ascending', async () => {
    const repo = new InMemoryScoreRepository();
    const slow = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 2_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const fast = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 1_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(slow);
    await repo.save(fast);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'elapsedMs', order: 'asc' });
    expect(top.map((item) => item.id)).toEqual(['2', '1']);
  });

  it('orders by elapsedMs descending', async () => {
    const repo = new InMemoryScoreRepository();
    const slow = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 2_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const fast = score({
      id: '2',
      playerName: 'B',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 1_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(slow);
    await repo.save(fast);

    const top = await repo.listTop({
      limit: 10,
      boardSize: null,
      sort: 'elapsedMs',
      order: 'desc',
    });
    expect(top.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('orders by playerName case-insensitively', async () => {
    const repo = new InMemoryScoreRepository();
    const lowercase = score({
      id: '1',
      playerName: 'ana',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const uppercase = score({
      id: '2',
      playerName: 'Ana',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });
    const mixed = score({
      id: '3',
      playerName: 'Zoe',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:02.000Z',
    });

    await repo.save(mixed);
    await repo.save(uppercase);
    await repo.save(lowercase);

    const top = await repo.listTop({
      limit: 10,
      boardSize: null,
      sort: 'playerName',
      order: 'asc',
    });
    // 'Ana' and 'ana' normalise to the same string, so the group order is decided
    // by a code-unit comparison of the original names, where 'A' (U+0041) sorts
    // before 'a' (U+0061). This is deliberately not locale collation: the DynamoDB
    // adapter will compare a normalised attribute by code unit, and a locale-aware
    // comparison here would make the two adapters disagree.
    expect(top.map((item) => item.id)).toEqual(['2', '1', '3']);
  });

  it('breaks a case-insensitive tie by code unit on the original name', async () => {
    const repo = new InMemoryScoreRepository();
    const capitalA = score({
      id: '1',
      playerName: 'Ana',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    const lowercaseA = score({
      id: '2',
      playerName: 'ana',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });

    await repo.save(lowercaseA);
    await repo.save(capitalA);

    const top = await repo.listTop({
      limit: 10,
      boardSize: null,
      sort: 'playerName',
      order: 'asc',
    });
    expect(top.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('uses the stable tiebreaker chain for identical primary values', async () => {
    const repo = new InMemoryScoreRepository();
    const first = score({
      id: '1',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:01.000Z',
    });
    const second = score({
      id: '2',
      playerName: 'A',
      boardSize: 5,
      moves: 7,
      elapsedMs: 1_000,
      points: 2_000,
      createdAt: '2026-09-24T12:00:00.000Z',
    });

    await repo.save(first);
    await repo.save(second);

    const top = await repo.listTop({ limit: 10, boardSize: null, sort: 'points', order: 'desc' });
    expect(top.map((item) => item.id)).toEqual(['2', '1']);
  });
});
