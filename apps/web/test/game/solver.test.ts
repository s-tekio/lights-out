import { describe, expect, it } from 'vitest';
import { createBoard, toggleAt } from '../../src/game/board';
import { isSolvableWithin } from '../../src/game/solver';

function applyPresses(board: ReturnType<typeof createBoard>, presses: readonly number[]) {
  let current = board;
  for (const index of presses) {
    current = toggleAt(current, index);
  }
  return current;
}

/**
 * Reference toggle implementation, written independently of `toggleAt`. A
 * separate implementation catches representation bugs in the solver even if
 * production `toggleAt` changes.
 */
function referenceToggleAt(board: ReturnType<typeof createBoard>, index: number): boolean[] {
  const size = Math.sqrt(board.length);
  const row = Math.floor(index / size);
  const col = index % size;

  return board.map((lit, currentIndex) => {
    const currentRow = Math.floor(currentIndex / size);
    const currentCol = currentIndex % size;
    const isPressedCell = currentIndex === index;
    const isOrthogonalNeighbour = Math.abs(currentRow - row) + Math.abs(currentCol - col) === 1;

    return isPressedCell || isOrthogonalNeighbour ? !lit : lit;
  });
}

function referenceApplyPresses(
  board: ReturnType<typeof createBoard>,
  presses: readonly number[],
): boolean[] {
  let current = board.slice();
  for (const index of presses) {
    current = referenceToggleAt(current, index);
  }
  return current;
}

/**
 * Pre-compute the cells toggled by each press, shared by the reference helpers
 * so the searches never rebuild a board from scratch.
 */
function buildAffectedCells(size: number): readonly (readonly number[])[] {
  const cellCount = size * size;
  const affected: number[][] = [];

  for (let index = 0; index < cellCount; index += 1) {
    const row = Math.floor(index / size);
    const col = index % size;
    const cells: number[] = [];

    for (let other = 0; other < cellCount; other += 1) {
      const otherRow = Math.floor(other / size);
      const otherCol = other % size;
      const isPressedCell = other === index;
      const isOrthogonalNeighbour = Math.abs(otherRow - row) + Math.abs(otherCol - col) === 1;

      if (isPressedCell || isOrthogonalNeighbour) {
        cells.push(other);
      }
    }

    affected.push(cells);
  }

  return affected;
}

/**
 * Reference solver using boolean arrays and no bitwise operators. It enumerates
 * subsets of distinct cells up to `maxPresses` and checks whether any subset
 * toggles every lit cell off.
 *
 * A regression test must not share the implementation's representation: the
 * original defect came from folding the board state into a 32-bit bitmask, so a
 * reference using a bitmask would agree with the buggy code and hide the failure.
 *
 * The board is mutated in place and a running lit-cell count replaces scanning
 * for a solved board. That is a performance choice, not a correctness one; the
 * reference stays independent because it never uses bitwise operators.
 */
function referenceIsSolvableWithin(
  board: ReturnType<typeof createBoard>,
  maxPresses: number,
): boolean {
  const size = Math.sqrt(board.length);
  const affected = buildAffectedCells(size);
  const working = board.slice();
  let litCount = working.filter((lit) => lit).length;

  function toggle(index: number): void {
    const cells = affected[index];

    if (cells === undefined) {
      return;
    }

    for (const cell of cells) {
      const wasLit = working[cell] === true;
      working[cell] = !wasLit;
      litCount += wasLit ? -1 : 1;
    }
  }

  function search(startIndex: number, depth: number): boolean {
    if (litCount === 0) {
      return true;
    }

    if (depth === maxPresses) {
      return false;
    }

    for (let index = startIndex; index < working.length; index += 1) {
      toggle(index);

      if (search(index + 1, depth + 1)) {
        toggle(index);
        return true;
      }

      toggle(index);
    }

    return false;
  }

  return search(0, 0);
}

/**
 * Deterministic seeded pseudo-random generator for reproducible tests.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function generateRandomBoard(size: number, pressesCount: number, random: () => number): boolean[] {
  const cellCount = size * size;
  const presses: number[] = [];

  for (let step = 0; step < pressesCount; step += 1) {
    presses.push(Math.floor(random() * cellCount));
  }

  return referenceApplyPresses(createBoard(size), presses);
}

/**
 * Negate a single cell in place. Test helper used to build the original
 * counterexample.
 */
function flip(board: ReturnType<typeof createBoard>, index: number): boolean[] {
  return board.map((lit, currentIndex) => (currentIndex === index ? !lit : lit));
}

function trueMinimumPresses(board: ReturnType<typeof createBoard>): number {
  const cellCount = board.length;
  const affected = buildAffectedCells(Math.sqrt(cellCount));
  const working = board.slice();
  let litCount = working.filter((lit) => lit).length;
  let minimum = Number.POSITIVE_INFINITY;

  function toggle(index: number): void {
    const cells = affected[index];

    if (cells === undefined) {
      return;
    }

    for (const cell of cells) {
      const wasLit = working[cell] === true;
      working[cell] = !wasLit;
      litCount += wasLit ? -1 : 1;
    }
  }

  function enumerate(startIndex: number, presses: number): void {
    if (presses >= minimum) {
      return;
    }

    if (litCount === 0) {
      minimum = presses;
      return;
    }

    if (startIndex === cellCount) {
      return;
    }

    enumerate(startIndex + 1, presses);
    toggle(startIndex);
    enumerate(startIndex + 1, presses + 1);
    toggle(startIndex);
  }

  enumerate(0, 0);
  return minimum;
}

describe('isSolvableWithin', () => {
  it('returns true for a solved board when maxPresses is 0', () => {
    expect(isSolvableWithin(createBoard(3), 0)).toBe(true);
  });

  it('returns false for a board needing a press when maxPresses is 0', () => {
    const board = applyPresses(createBoard(3), [4]);

    expect(isSolvableWithin(board, 0)).toBe(false);
  });

  it('returns true for a board one press from solved when maxPresses is 1', () => {
    const board = applyPresses(createBoard(3), [4]);

    expect(isSolvableWithin(board, 1)).toBe(true);
  });

  it('returns false for a board one press from solved when maxPresses is 0', () => {
    const board = applyPresses(createBoard(3), [4]);

    expect(isSolvableWithin(board, 0)).toBe(false);
  });

  it('returns true for a board needing three presses when maxPresses is 3', () => {
    const board = applyPresses(createBoard(3), [0, 1, 2]);

    expect(isSolvableWithin(board, 2)).toBe(false);
    expect(isSolvableWithin(board, 3)).toBe(true);
  });

  it('matches the exhaustive true minimum for every 3x3 board', () => {
    const size = 3;
    const cellCount = size * size;

    for (let mask = 0; mask < 1 << cellCount; mask += 1) {
      const presses: number[] = [];
      for (let index = 0; index < cellCount; index += 1) {
        if ((mask & (1 << index)) !== 0) {
          presses.push(index);
        }
      }

      const board = applyPresses(createBoard(size), presses);
      const minimum = trueMinimumPresses(board);

      for (let maxPresses = 0; maxPresses <= 4; maxPresses += 1) {
        const expected = minimum <= maxPresses;
        expect(isSolvableWithin(board, maxPresses)).toBe(expected);
      }
    }
  });

  it('returns false for the 7x7 bitmask counterexample within one press', () => {
    let board = createBoard(7);
    board = toggleAt(board, 0);
    board = flip(board, 0);
    board = flip(board, 32);

    expect(isSolvableWithin(board, 1)).toBe(false);
  });

  it('matches the reference for every 7x7 single-press board', () => {
    const size = 7;
    const cellCount = size * size;

    for (let index = 0; index < cellCount; index += 1) {
      const board = toggleAt(createBoard(size), index);

      expect(isSolvableWithin(board, 1)).toBe(referenceIsSolvableWithin(board, 1));
    }
  });

  it('matches the reference for 500 seeded random 7x7 boards', () => {
    const random = seededRandom(12345);

    for (let index = 0; index < 500; index += 1) {
      const pressesCount = 1 + Math.floor(random() * 6);
      const board = generateRandomBoard(7, pressesCount, random);

      for (const maxPresses of [0, 1, 2]) {
        expect(isSolvableWithin(board, maxPresses)).toBe(
          referenceIsSolvableWithin(board, maxPresses),
        );
      }
    }
  }, 30_000);

  it('matches the reference for 200 seeded random 9x9 boards', () => {
    const random = seededRandom(67890);

    for (let index = 0; index < 200; index += 1) {
      const pressesCount = 1 + Math.floor(random() * 6);
      const board = generateRandomBoard(9, pressesCount, random);

      for (const maxPresses of [0, 1, 2]) {
        expect(isSolvableWithin(board, maxPresses)).toBe(
          referenceIsSolvableWithin(board, maxPresses),
        );
      }
    }
  }, 120_000);

  it('throws for a negative maxPresses', () => {
    expect(() => isSolvableWithin(createBoard(3), -1)).toThrow();
  });

  it('throws for a non-integer maxPresses', () => {
    expect(() => isSolvableWithin(createBoard(3), 1.5)).toThrow();
  });
});
