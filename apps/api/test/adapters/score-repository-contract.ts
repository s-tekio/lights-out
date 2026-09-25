import { beforeEach, describe, expect, it } from 'vitest';
import type { Score } from '../../src/domain/score.js';
import type { ScoreRepository } from '../../src/ports/score-repository.js';

export type ScoreRepositoryContractOptions = {
  name: string;
  createRepository: () => ScoreRepository;
  reset: () => Promise<void>;
};

let idCounter = 0;

function makeScore(overrides: Partial<Score> & Pick<Score, 'playerName'>): Score {
  idCounter += 1;
  const index = idCounter;

  return {
    id: overrides.id ?? `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    playerName: overrides.playerName,
    boardSize: overrides.boardSize ?? 5,
    moves: overrides.moves ?? 7,
    elapsedMs: overrides.elapsedMs ?? 1_000,
    points: overrides.points ?? 1_000,
    createdAt: overrides.createdAt ?? `2026-09-24T12:00:00.${String(index).padStart(3, '0')}Z`,
  };
}

export function runScoreRepositoryContract({
  name,
  createRepository,
  reset,
}: ScoreRepositoryContractOptions): void {
  describe(name, () => {
    beforeEach(async () => {
      await reset();
      idCounter = 0;
    });

    it('saves and returns the same score', async () => {
      const repo = createRepository();
      const score = makeScore({ playerName: 'Tekio' });

      const saved = await repo.save(score);
      expect(saved).toBe(score);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      });
      expect(top).toEqual([score]);
    });

    it('orders by points descending in the natural direction', async () => {
      const repo = createRepository();
      const high = makeScore({ playerName: 'A', points: 3_000 });
      const low = makeScore({ playerName: 'B', points: 2_000 });

      await repo.save(high);
      await repo.save(low);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      });
      expect(top.map((item) => item.id)).toEqual([high.id, low.id]);
    });

    it('orders by points ascending as the exact mirror of descending', async () => {
      const repo = createRepository();
      const high = makeScore({ playerName: 'A', points: 3_000 });
      const low = makeScore({ playerName: 'B', points: 2_000 });

      await repo.save(high);
      await repo.save(low);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'asc',
      });
      expect(top.map((item) => item.id)).toEqual([low.id, high.id]);
    });

    it('breaks points ties by createdAt ascending in the natural direction', async () => {
      const repo = createRepository();
      const earlier = makeScore({
        playerName: 'A',
        points: 2_000,
        createdAt: '2026-09-24T12:00:00.000Z',
      });
      const later = makeScore({
        playerName: 'B',
        points: 2_000,
        createdAt: '2026-09-24T12:00:01.000Z',
      });

      await repo.save(earlier);
      await repo.save(later);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      });
      expect(top.map((item) => item.id)).toEqual([earlier.id, later.id]);
    });

    it('breaks points ties by createdAt descending in the mirror direction', async () => {
      const repo = createRepository();
      const earlier = makeScore({
        playerName: 'A',
        points: 2_000,
        createdAt: '2026-09-24T12:00:00.000Z',
      });
      const later = makeScore({
        playerName: 'B',
        points: 2_000,
        createdAt: '2026-09-24T12:00:01.000Z',
      });

      await repo.save(earlier);
      await repo.save(later);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'asc',
      });
      expect(top.map((item) => item.id)).toEqual([later.id, earlier.id]);
    });

    it('orders by elapsedMs ascending in the natural direction', async () => {
      const repo = createRepository();
      const slow = makeScore({ playerName: 'A', elapsedMs: 2_000 });
      const fast = makeScore({ playerName: 'B', elapsedMs: 1_000 });

      await repo.save(slow);
      await repo.save(fast);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'asc',
      });
      expect(top.map((item) => item.id)).toEqual([fast.id, slow.id]);
    });

    it('orders by elapsedMs descending as the exact mirror', async () => {
      const repo = createRepository();
      const slow = makeScore({ playerName: 'A', elapsedMs: 2_000 });
      const fast = makeScore({ playerName: 'B', elapsedMs: 1_000 });

      await repo.save(slow);
      await repo.save(fast);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'desc',
      });
      expect(top.map((item) => item.id)).toEqual([slow.id, fast.id]);
    });

    it('breaks elapsedMs ties by the full mirror tiebreaker chain', async () => {
      const repo = createRepository();
      const first = makeScore({
        playerName: 'A',
        elapsedMs: 1_000,
        createdAt: '2026-09-24T12:00:00.000Z',
      });
      const second = makeScore({
        playerName: 'B',
        elapsedMs: 1_000,
        createdAt: '2026-09-24T12:00:01.000Z',
      });

      await repo.save(first);
      await repo.save(second);

      const natural = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'asc',
      });
      expect(natural.map((item) => item.id)).toEqual([first.id, second.id]);

      const mirror = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'desc',
      });
      expect(mirror.map((item) => item.id)).toEqual([second.id, first.id]);
    });

    it('orders by playerName case-insensitively in the natural direction', async () => {
      const repo = createRepository();
      const lowercase = makeScore({ playerName: 'ana' });
      const uppercase = makeScore({ playerName: 'Ana' });
      const mixed = makeScore({ playerName: 'Zoe' });

      await repo.save(mixed);
      await repo.save(uppercase);
      await repo.save(lowercase);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'playerName',
        order: 'asc',
      });
      // Inside the case-insensitive "ana" group, the original name orders by
      // UTF-16 code unit: 'A' (U+0041) precedes 'a' (U+0061).
      expect(top.map((item) => item.id)).toEqual([uppercase.id, lowercase.id, mixed.id]);
    });

    it('orders by playerName as the exact mirror in descending order', async () => {
      const repo = createRepository();
      const lowercase = makeScore({ playerName: 'ana' });
      const uppercase = makeScore({ playerName: 'Ana' });
      const mixed = makeScore({ playerName: 'Zoe' });

      await repo.save(mixed);
      await repo.save(uppercase);
      await repo.save(lowercase);

      const top = await repo.listTop({
        limit: 10,
        boardSize: null,
        sort: 'playerName',
        order: 'desc',
      });
      expect(top.map((item) => item.id)).toEqual([mixed.id, lowercase.id, uppercase.id]);
    });

    it('truncates results to the requested limit', async () => {
      const repo = createRepository();
      for (let index = 0; index < 5; index += 1) {
        await repo.save(makeScore({ playerName: `Player ${index}`, points: 1_000 - index }));
      }

      const top = await repo.listTop({
        limit: 3,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      });
      expect(top.length).toBe(3);
    });

    it('filters by board size', async () => {
      const repo = createRepository();
      const sizeFive = makeScore({ playerName: 'A', boardSize: 5, points: 2_000 });
      const sizeSix = makeScore({ playerName: 'B', boardSize: 6, points: 3_000 });

      await repo.save(sizeFive);
      await repo.save(sizeSix);

      const top = await repo.listTop({
        limit: 10,
        boardSize: 5,
        sort: 'points',
        order: 'desc',
      });
      expect(top).toEqual([sizeFive]);
    });

    it('reports the correct rank with ties broken by elapsedMs', async () => {
      const repo = createRepository();
      const slower = makeScore({
        playerName: 'A',
        elapsedMs: 2_000,
        points: 2_000,
      });
      const faster = makeScore({
        playerName: 'B',
        elapsedMs: 1_000,
        points: 2_000,
      });

      await repo.save(slower);
      await repo.save(faster);

      expect(await repo.rankOf(faster)).toBe(1);
      expect(await repo.rankOf(slower)).toBe(2);
    });

    it('reports the correct rank with ties broken by createdAt and id', async () => {
      const repo = createRepository();
      const first = makeScore({
        playerName: 'A',
        elapsedMs: 1_000,
        points: 2_000,
        createdAt: '2026-09-24T12:00:00.000Z',
      });
      const second = makeScore({
        playerName: 'B',
        elapsedMs: 1_000,
        points: 2_000,
        createdAt: '2026-09-24T12:00:01.000Z',
      });

      await repo.save(first);
      await repo.save(second);

      expect(await repo.rankOf(first)).toBe(1);
      expect(await repo.rankOf(second)).toBe(2);
    });
  });
}
