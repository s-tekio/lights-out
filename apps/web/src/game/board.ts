import { MAX_BOARD_SIZE, MIN_BOARD_SIZE } from './difficulty';
import { isSolvableWithin } from './solver';

/**
 * Board representation: a flat, read-only array of booleans.
 *
 * For a board of size `n`, the cell at row `r` and column `c` is at index
 * `r * n + c`. A flat array makes cloning, indexing and neighbour checks
 * straightforward while keeping the public type immutable.
 */
export type Board = ReadonlyArray<boolean>;

function assertValidSize(size: number): void {
  if (!Number.isInteger(size) || size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) {
    throw new Error(
      `Board size must be an integer between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE}, got ${size}`,
    );
  }
}

function assertValidIndex(board: Board, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= board.length) {
    throw new Error(`Index ${index} is out of bounds for board of length ${board.length}`);
  }
}

function boardSizeFromLength(length: number): number {
  const size = Math.sqrt(length);

  if (!Number.isInteger(size)) {
    throw new Error('Board length is not a perfect square');
  }

  return size;
}

export function createBoard(size: number): Board {
  assertValidSize(size);
  return Array.from<boolean>({ length: size * size }).fill(false);
}

export function toggleAt(board: Board, index: number): Board {
  assertValidIndex(board, index);

  const size = boardSizeFromLength(board.length);
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

export function isSolved(board: Board): boolean {
  return board.every((lit) => !lit);
}

/**
 * Toggle a press in-place on a mutable board.
 *
 * Presses are self-inverse, so the same helper applies a press and undoes it
 * during generation.
 */
function pressInPlace(board: boolean[], size: number, index: number): void {
  const row = Math.floor(index / size);
  const col = index % size;

  for (let currentIndex = 0; currentIndex < board.length; currentIndex += 1) {
    const currentRow = Math.floor(currentIndex / size);
    const currentCol = currentIndex % size;
    const isPressedCell = currentIndex === index;
    const isOrthogonalNeighbour = Math.abs(currentRow - row) + Math.abs(currentCol - col) === 1;

    if (isPressedCell || isOrthogonalNeighbour) {
      const current = board[currentIndex];
      board[currentIndex] = current === undefined ? false : !current;
    }
  }
}

/**
 * Find the first set of exactly `pressCount` distinct cells whose board is not
 * solvable in `pressCount - 1` presses.
 *
 * Deterministic fallback for when random scrambling keeps producing boards
 * that are too easy. Every supported size has configurations that need at
 * least this many presses, so a valid set always exists.
 */
function findFirstValidPressSet(size: number, pressCount: number): readonly number[] {
  const cellCount = size * size;
  const board = createBoard(size).slice();
  const set: number[] = [];

  function search(startIndex: number): readonly number[] | null {
    if (set.length === pressCount) {
      if (!isSolvableWithin(board, pressCount - 1)) {
        return set.slice();
      }
      return null;
    }

    for (let index = startIndex; index < cellCount; index += 1) {
      set.push(index);
      pressInPlace(board, size, index);

      const result = search(index + 1);
      if (result !== null) {
        return result;
      }

      pressInPlace(board, size, index);
      set.pop();
    }

    return null;
  }

  const result = search(0);

  if (result === null) {
    throw new Error(
      `Invariant: no ${pressCount}-press board found for size ${size} that requires ${pressCount} presses`,
    );
  }

  return result;
}

// Random scrambles to try before the deterministic fallback. 20 is enough
// that the fallback is rarely needed for the supported difficulties.
const MAX_GENERATION_ATTEMPTS = 20;

export function createSolvableBoard(
  size: number,
  scrambleDepth: number,
  random: () => number,
  minPresses?: number,
): { readonly board: Board; readonly presses: readonly number[] } {
  assertValidSize(size);

  if (!Number.isInteger(scrambleDepth) || scrambleDepth < 0) {
    throw new Error(`scrambleDepth must be a non-negative integer, got ${scrambleDepth}`);
  }

  if (minPresses !== undefined && (!Number.isInteger(minPresses) || minPresses < 0)) {
    throw new Error(`minPresses must be a non-negative integer, got ${minPresses}`);
  }

  const effectiveMinPresses = minPresses ?? 0;

  const cellCount = size * size;

  if (effectiveMinPresses === 0) {
    const presses: number[] = [];
    const board = createBoard(size).slice();

    for (let step = 0; step < scrambleDepth; step += 1) {
      const index = Math.floor(random() * cellCount);
      presses.push(index);
      pressInPlace(board, size, index);
    }

    return { board, presses };
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const presses: number[] = [];
    const board = createBoard(size).slice();

    for (let step = 0; step < scrambleDepth; step += 1) {
      const index = Math.floor(random() * cellCount);
      presses.push(index);
      pressInPlace(board, size, index);
    }

    if (!isSolvableWithin(board, effectiveMinPresses - 1)) {
      return { board, presses };
    }
  }

  const fallbackPresses = findFirstValidPressSet(size, effectiveMinPresses);
  const fallbackBoard = createBoard(size).slice();

  for (const index of fallbackPresses) {
    pressInPlace(fallbackBoard, size, index);
  }

  return { board: fallbackBoard, presses: fallbackPresses };
}
