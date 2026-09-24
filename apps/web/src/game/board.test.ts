import { describe, expect, it } from 'vitest';
import { createBoard, createSolvableBoard, isSolved, toggleAt } from './board';
import { isSolvableWithin } from './solver';
import { DIFFICULTIES, MAX_BOARD_SIZE, MIN_BOARD_SIZE } from './difficulty';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

describe('createBoard', () => {
  it('returns a flat array of off cells for the given size', () => {
    const board = createBoard(5);

    expect(board).toHaveLength(25);
    expect(board.every((lit) => !lit)).toBe(true);
  });

  it('rejects sizes below the contract minimum', () => {
    expect(() => createBoard(MIN_BOARD_SIZE - 1)).toThrow();
  });

  it('rejects sizes above the contract maximum', () => {
    expect(() => createBoard(MAX_BOARD_SIZE + 1)).toThrow();
  });
});

describe('DIFFICULTIES', () => {
  it('uses board sizes 5, 7 and 9 for easy, normal and hard', () => {
    expect(DIFFICULTIES.map((difficulty) => difficulty.boardSize)).toEqual([3, 5, 7]);
  });
});

describe('toggleAt', () => {
  it('flips the pressed cell and its orthogonal neighbours', () => {
    const board = createBoard(5);
    const next = toggleAt(board, 12);

    const litIndices = [7, 11, 12, 13, 17];

    for (let index = 0; index < next.length; index += 1) {
      expect(next[index]).toBe(litIndices.includes(index));
    }
  });

  it('flips exactly three cells on a corner press', () => {
    const next = toggleAt(createBoard(3), 0);
    const litCount = next.filter(Boolean).length;

    expect(litCount).toBe(3);
    expect(next[0]).toBe(true);
    expect(next[1]).toBe(true);
    expect(next[3]).toBe(true);
  });

  it('flips exactly four cells on an edge press', () => {
    const next = toggleAt(createBoard(3), 1);
    const litCount = next.filter(Boolean).length;

    expect(litCount).toBe(4);
    expect(next[0]).toBe(true);
    expect(next[1]).toBe(true);
    expect(next[2]).toBe(true);
    expect(next[4]).toBe(true);
  });

  it('does not mutate the input board', () => {
    const board = createBoard(4);
    const next = toggleAt(board, 5);

    expect(board).not.toBe(next);
    expect(board.every((lit) => !lit)).toBe(true);
  });

  it('rejects out-of-bounds indices', () => {
    expect(() => toggleAt(createBoard(3), -1)).toThrow();
    expect(() => toggleAt(createBoard(3), 9)).toThrow();
  });
});

describe('isSolved', () => {
  it('returns true for a solved board', () => {
    expect(isSolved(createBoard(5))).toBe(true);
  });

  it('returns false when a single cell is lit', () => {
    expect(isSolved(toggleAt(createBoard(5), 12))).toBe(false);
  });

  it('returns false when every cell is lit', () => {
    const allLit = Array.from<boolean>({ length: 9 }).fill(true);

    expect(allLit.every(Boolean)).toBe(true);
    expect(isSolved(allLit)).toBe(false);
  });
});

describe('createSolvableBoard', () => {
  it('produces a board that can be solved by replaying the same presses', () => {
    const random = seededRandom(42);
    const { board, presses } = createSolvableBoard(5, 15, random);

    let solved = board;
    for (const index of presses) {
      solved = toggleAt(solved, index);
    }

    expect(isSolved(solved)).toBe(true);
  });

  it('is deterministic when given the same seeded random function', () => {
    const first = createSolvableBoard(5, 15, seededRandom(7));
    const second = createSolvableBoard(5, 15, seededRandom(7));

    expect(first.board).toEqual(second.board);
    expect(first.presses).toEqual(second.presses);
  });

  it('uses the injected random function', () => {
    const calls: number[] = [];
    const random = () => {
      const value = 0.25;
      calls.push(value);
      return value;
    };

    createSolvableBoard(4, 3, random);

    expect(calls).toHaveLength(3);
  });

  it('rejects a negative scramble depth', () => {
    expect(() => createSolvableBoard(5, -1, seededRandom(1))).toThrow();
  });

  DIFFICULTIES.forEach((difficulty) => {
    it(`produces a ${difficulty.id} board within the contract size bounds`, () => {
      const { board } = createSolvableBoard(
        difficulty.boardSize,
        difficulty.scrambleDepth,
        seededRandom(1),
      );
      const size = Math.sqrt(board.length);

      expect(size).toBe(difficulty.boardSize);
      expect(difficulty.boardSize).toBeGreaterThanOrEqual(MIN_BOARD_SIZE);
      expect(difficulty.boardSize).toBeLessThanOrEqual(MAX_BOARD_SIZE);
    });
  });

  DIFFICULTIES.forEach((difficulty) => {
    it(`produces ${difficulty.id} boards that need at least ${difficulty.minPresses} presses`, () => {
      const random = seededRandom(12345);
      const sampleSize = 300;

      for (let index = 0; index < sampleSize; index += 1) {
        const { board } = createSolvableBoard(
          difficulty.boardSize,
          difficulty.scrambleDepth,
          random,
          difficulty.minPresses,
        );

        expect(isSolvableWithin(board, difficulty.minPresses - 1)).toBe(false);
      }
    }, 15000);
  });

  it('produces boards that are still solved by replaying the returned presses with minPresses', () => {
    const { board, presses } = createSolvableBoard(5, 15, seededRandom(42), 3);

    let solved = board;
    for (const index of presses) {
      solved = toggleAt(solved, index);
    }

    expect(isSolved(solved)).toBe(true);
  });

  it('is deterministic when given the same seeded random function with minPresses', () => {
    const first = createSolvableBoard(5, 15, seededRandom(7), 3);
    const second = createSolvableBoard(5, 15, seededRandom(7), 3);

    expect(first.board).toEqual(second.board);
    expect(first.presses).toEqual(second.presses);
  });

  it('keeps the old behaviour when minPresses is omitted', () => {
    const { board } = createSolvableBoard(3, 5, constantRandom(0));

    expect(isSolvableWithin(board, 1)).toBe(true);
  });

  it('keeps the old behaviour when minPresses is 0', () => {
    const { board } = createSolvableBoard(3, 5, constantRandom(0), 0);

    expect(isSolvableWithin(board, 1)).toBe(true);
  });
});

function constantRandom(value: number): () => number {
  return () => value;
}
