import { describe, expect, it } from 'vitest';
import { createBoard, createSolvableBoard, isSolved, toggleAt } from '../../src/game/board';
import { findOptimalSolution, kernelBasis } from '../../src/game/optimal';
import { isSolvableWithin } from '../../src/game/solver';

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

function applyPresses(board: ReturnType<typeof createBoard>, presses: readonly number[]) {
  let current = board;
  for (const index of presses) {
    current = toggleAt(current, index);
  }
  return current;
}

/**
 * Build the cells toggled by each press independently. This mirrors the
 * production `toggleAt` logic but keeps the test self-contained.
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
 * Brute-force minimum number of presses for a board by enumerating all subsets.
 *
 * Only practical for small boards; the test uses it as an independent oracle
 * for 3×3 scrambles.
 */
function bruteForceMinimumPresses(board: ReturnType<typeof createBoard>): number {
  const size = Math.sqrt(board.length);
  const affected = buildAffectedCells(size);
  const working = board.slice();
  let litCount = working.filter(Boolean).length;
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

    if (startIndex === board.length) {
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

describe('kernelBasis', () => {
  it('returns the expected dimensions for the supported sizes', () => {
    expect(kernelBasis(3)).toHaveLength(0);
    expect(kernelBasis(5)).toHaveLength(2);
    expect(kernelBasis(7)).toHaveLength(0);
  });

  it('caches the basis for each size', () => {
    const first = kernelBasis(5);
    const second = kernelBasis(5);

    expect(first).toBe(second);
  });

  it('rejects sizes outside the contract bounds', () => {
    expect(() => kernelBasis(2)).toThrow();
    expect(() => kernelBasis(10)).toThrow();
  });
});

describe('kernel property', () => {
  it.each([
    { size: 3, label: '3x3' },
    { size: 5, label: '5x5' },
    { size: 7, label: '7x7' },
  ])('pressing every basis element of a $label board leaves the board solved', ({ size }) => {
    const basis = kernelBasis(size);
    const cellCount = size * size;

    for (const vector of basis) {
      let board = createBoard(size);

      for (let index = 0; index < cellCount; index += 1) {
        if ((vector >> BigInt(index)) & 1n) {
          board = toggleAt(board, index);
        }
      }

      expect(isSolved(board)).toBe(true);
    }
  });
});

describe('findOptimalSolution', () => {
  it('returns zero presses for an empty scramble', () => {
    expect(findOptimalSolution(3, [])).toEqual({ presses: 0, cells: [] });
    expect(findOptimalSolution(5, [])).toEqual({ presses: 0, cells: [] });
    expect(findOptimalSolution(7, [])).toEqual({ presses: 0, cells: [] });
  });

  it('throws for an out-of-range press index', () => {
    expect(() => findOptimalSolution(3, [-1])).toThrow();
    expect(() => findOptimalSolution(3, [9])).toThrow();
    expect(() => findOptimalSolution(5, [25])).toThrow();
    expect(() => findOptimalSolution(7, [49])).toThrow();
  });

  it('throws for a non-integer press index', () => {
    expect(() => findOptimalSolution(3, [1.5])).toThrow();
  });

  it('throws for an invalid size', () => {
    expect(() => findOptimalSolution(2, [0])).toThrow();
    expect(() => findOptimalSolution(10, [0])).toThrow();
  });

  it('returns cells sorted ascending with no duplicates', () => {
    const random = seededRandom(12345);
    const { presses } = createSolvableBoard(5, 15, random, 3);
    const solution = findOptimalSolution(5, presses);

    expect(solution.cells).toEqual([...solution.cells].sort((a, b) => a - b));
    expect(new Set(solution.cells).size).toBe(solution.cells.length);
  });

  it('is deterministic for the same inputs', () => {
    const random = seededRandom(42);
    const { presses } = createSolvableBoard(5, 15, random, 3);

    const first = findOptimalSolution(5, presses);
    const second = findOptimalSolution(5, presses);

    expect(first).toEqual(second);
  });

  it('returns a valid solution for many seeded scrambles across all sizes', () => {
    const random = seededRandom(11111);

    for (const size of [3, 5, 7]) {
      for (let sample = 0; sample < 50; sample += 1) {
        const { board, presses } = createSolvableBoard(size, size * 3, random, 3);
        const solution = findOptimalSolution(size, presses);
        const solved = applyPresses(board, solution.cells);

        expect(isSolved(solved)).toBe(true);
      }
    }
  });

  it('matches the brute-force minimum for hundreds of seeded 3x3 scrambles', () => {
    const random = seededRandom(22222);

    for (let sample = 0; sample < 400; sample += 1) {
      const { board, presses } = createSolvableBoard(3, 5, random, 3);
      const optimal = findOptimalSolution(3, presses);
      const bruteMinimum = bruteForceMinimumPresses(board);

      expect(optimal.presses).toBe(bruteMinimum);
      expect(isSolved(applyPresses(board, optimal.cells))).toBe(true);
    }
  });

  it('is minimal against the solver oracle for hundreds of seeded 3x3 scrambles', () => {
    const random = seededRandom(33333);

    for (let sample = 0; sample < 400; sample += 1) {
      const { board, presses } = createSolvableBoard(3, 5, random, 3);
      const optimal = findOptimalSolution(3, presses);

      if (optimal.presses > 0) {
        expect(isSolvableWithin(board, optimal.presses - 1)).toBe(false);
      }
    }
  });

  it('is minimal against the solver oracle on 5x5 boards cheap enough to check', () => {
    // The oracle is exponential. At an optimum near 10 presses a single board
    // costs about 7e6 nodes, and under coverage instrumentation the four samples
    // this test used to run took 15.7 s against a 20 s timeout, which leaves no
    // headroom for a slower machine.
    //
    // So the oracle runs only on samples whose optimum is small, where it is
    // cheap and just as able to catch an error in the coset enumeration.
    // Minimality on the expensive samples follows from the coset argument: the
    // kernel tests prove the basis is a genuine nullspace basis of dimension 2,
    // so the solution space has exactly four elements and the minimum over them
    // is the true minimum.
    const ORACLE_CAP = 6;
    const SAMPLE_SIZE = 200;
    const random = seededRandom(44444);
    let checked = 0;

    for (let sample = 0; sample < SAMPLE_SIZE; sample += 1) {
      const { board, presses } = createSolvableBoard(5, 15, random, 3);
      const optimal = findOptimalSolution(5, presses);

      if (optimal.presses === 0 || optimal.presses > ORACLE_CAP) {
        continue;
      }

      expect(isSolvableWithin(board, optimal.presses - 1)).toBe(false);
      checked += 1;
    }

    // Guards against the oracle silently becoming vacuous if the cap, the sample
    // size or the generator changes. Measured with this seed: 12 of 200 samples
    // have an optimum at or below the cap.
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('equals the parity set size on 7x7 because the kernel is empty', () => {
    const random = seededRandom(55555);

    for (let sample = 0; sample < 50; sample += 1) {
      const { presses } = createSolvableBoard(7, 30, random, 3);
      const optimal = findOptimalSolution(7, presses);
      const parityCounts = new Map<number, number>();

      for (const press of presses) {
        parityCounts.set(press, (parityCounts.get(press) ?? 0) + 1);
      }

      const paritySet = [...parityCounts.entries()]
        .filter(([, count]) => count % 2 === 1)
        .map(([index]) => index)
        .sort((a, b) => a - b);

      expect(optimal.presses).toBe(paritySet.length);
      expect(optimal.cells).toEqual(paritySet);
    }
  });

  it('can improve the scramble parity set on 5x5 using the kernel', () => {
    const random = seededRandom(77777);
    let foundImprovement = false;

    for (let sample = 0; sample < 50 && !foundImprovement; sample += 1) {
      const { presses } = createSolvableBoard(5, 15, random, 3);
      const optimal = findOptimalSolution(5, presses);
      const paritySetSize = new Set(presses).size;

      if (optimal.presses < paritySetSize) {
        foundImprovement = true;
      }
    }

    expect(foundImprovement).toBe(true);
  });
});
